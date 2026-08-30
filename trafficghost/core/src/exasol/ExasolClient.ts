// TrafficGhost — Exasol WebSocket Client
// Implements the Exasol JSON-over-WebSocket protocol v3.
// Handles: login (RSA-encrypted password), execute, fetch, disconnect.
//
// Protocol: https://github.com/exasol/websocket-api
// Default local credentials (exasol install local): sys / exasol @ ws://localhost:8563

/// <reference types="node" />

import * as crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type { RequestLogEntry, EndpointModel } from "../models/types.js";
import { ALL_DDL } from "./ExasolDDL.js";

export interface ExasolConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  schema: string;
  aiApiKey?: string;
  aiEndpoint?: string;
  aiModel?: string;
}

export const DEFAULT_EXASOL_CONFIG: ExasolConfig = {
  host: "localhost",
  port: 8563,
  user: "sys",
  password: "exasol",
  schema: "TRAFFICGHOST",
};

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWebSocket = any;

export class ExasolClient {
  private ws: AnyWebSocket = null;
  private connected = false;
  private sessionId: string | null = null;
  private msgId = 0;
  private pendingResolvers = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(private readonly config: ExasolConfig = DEFAULT_EXASOL_CONFIG) {}

  isConnected(): boolean {
    return this.connected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  // ─── Connect + Login ────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected) return;

    // Dynamic import so ws is optional (graceful if not installed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let WebSocketCtor: any;
    try {
      const mod = await import("ws");
      WebSocketCtor = mod.WebSocket ?? (mod as unknown as { default: unknown }).default ?? mod;
    } catch {
      throw new Error(
        "ws package not installed. Run: cd trafficghost/core && npm install ws"
      );
    }

    return new Promise((resolve, reject) => {
      const url = `ws://${this.config.host}:${this.config.port}`;
      const ws = new WebSocketCtor(url, { rejectUnauthorized: false }) as AnyWebSocket;
      this.ws = ws;

      const timeout = setTimeout(() => {
        ws.terminate?.();
        reject(new Error(`Exasol connection timed out (${url})`));
      }, 8000);

      ws.on("error", (err: Error) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(new Error(`Exasol WebSocket error: ${err.message}`));
      });

      ws.on("close", () => {
        this.connected = false;
        this.ws = null;
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.on("message", (raw: any) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
          this.handleMessage(msg);
        } catch {
          /* ignore parse errors */
        }
      });

      ws.on("open", () => {
        void (async () => {
          try {
            // Step 1 — Request login, get RSA public key
            const loginResp = (await this.sendAndWait({
              command: "login",
              protocolVersion: 3,
            })) as {
              responseData?: {
                publicKeyPem?: string;
                publicKeyModulus?: string;
                publicKeyExponent?: string;
              };
            };

            const rd = loginResp.responseData;

            // Step 2 — Encrypt password
            let encPassword: string;
            if (rd?.publicKeyPem) {
              encPassword = this.encryptPasswordPem(
                this.config.password,
                rd.publicKeyPem
              );
            } else if (rd?.publicKeyModulus && rd?.publicKeyExponent) {
              encPassword = this.encryptPasswordModExp(
                this.config.password,
                rd.publicKeyModulus,
                rd.publicKeyExponent
              );
            } else {
              throw new Error("Exasol did not return a public key");
            }

            // Step 3 — Authenticate
            const authResult = (await this.sendAndWait({
              username: this.config.user,
              password: encPassword,
              useCompression: false,
              clientName: "TrafficGhost",
              clientVersion: "1.0.0",
            })) as { responseData?: { sessionId?: unknown } };

            this.sessionId = String(authResult.responseData?.sessionId ?? randomUUID());
            this.connected = true;
            clearTimeout(timeout);
            resolve();
          } catch (e) {
            clearTimeout(timeout);
            ws.terminate?.();
            reject(e as Error);
          }
        })();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (!this.ws) return;
    try {
      await this.sendAndWait({ command: "disconnect" });
    } catch {
      /* ignore */
    }
    try {
      this.ws?.terminate?.();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.connected = false;
  }

  // ─── SQL Execution ──────────────────────────────────────────────────────────

  async execute(sql: string): Promise<QueryResult> {
    if (!this.connected) throw new Error("Not connected to Exasol");

    const result = (await this.sendAndWait({
      command: "execute",
      sqlText: sql,
    })) as {
      responseData?: {
        results?: Array<{
          resultType: string;
          resultSet?: {
            numColumns: number;
            numRows: number;
            resultSetHandle?: number;
            columns?: Array<{ name: string }>;
            data?: unknown[][];
          };
        }>;
      };
    };

    const results = result.responseData?.results ?? [];
    if (results.length === 0) return { columns: [], rows: [] };

    const first = results[0];
    if (first.resultType !== "resultSet" || !first.resultSet) {
      return { columns: [], rows: [] };
    }

    const rs = first.resultSet;
    const columns = (rs.columns ?? []).map((c) => c.name);

    let rows: unknown[][] = [];
    if (rs.data) {
      rows = this.transposeColumnFirst(rs.data, rs.numRows, rs.numColumns);
    } else if (rs.numRows > 0 && rs.resultSetHandle !== undefined) {
      const fetchResult = (await this.sendAndWait({
        command: "fetch",
        resultSetHandle: rs.resultSetHandle,
        startPosition: 0,
        numBytes: 4194304,
      })) as { responseData?: { data?: unknown[][] } };
      const data = fetchResult.responseData?.data ?? [];
      rows = this.transposeColumnFirst(data, rs.numRows, rs.numColumns);
    }

    return { columns, rows };
  }

  // ─── Schema Setup ───────────────────────────────────────────────────────────

  async createTablesIfNotExist(): Promise<void> {
    for (const ddl of ALL_DDL) {
      try {
        await this.execute(ddl);
      } catch (e) {
        const msg = (e as Error).message;
        if (!msg.includes("already exists") && !msg.includes("object exists")) {
          throw e;
        }
      }
    }
  }

  // ─── Data Insertion ─────────────────────────────────────────────────────────

  async insertLog(entry: RequestLogEntry, sessionId: string): Promise<void> {
    if (!this.connected) return;
    const ts = new Date(entry.timestamp)
      .toISOString()
      .replace("T", " ")
      .replace("Z", "");
    const sql = `INSERT INTO TRAFFICGHOST.REQUEST_LOGS (SESSION_ID,LOG_ID,TS,METHOD,PATH,STATUS_CODE,DURATION_MS) VALUES ('${esc(sessionId)}','${esc(entry.id)}',TIMESTAMP '${ts}','${esc(entry.method)}','${esc(entry.path)}',${entry.status},${entry.durationMs})`;
    try {
      await this.execute(sql);
    } catch {
      /* fire-and-forget */
    }
  }

  async insertEndpoints(
    endpoints: EndpointModel[],
    sessionId: string
  ): Promise<void> {
    if (!this.connected || endpoints.length === 0) return;
    try {
      await this.execute(
        `DELETE FROM TRAFFICGHOST.ENDPOINTS WHERE SESSION_ID='${esc(sessionId)}'`
      );
      for (const ep of endpoints) {
        await this.execute(
          `INSERT INTO TRAFFICGHOST.ENDPOINTS (SESSION_ID,EP_ID,METHOD,PATH,IS_DYNAMIC,GROUP_NAME) VALUES ('${esc(sessionId)}','${esc(ep.id)}','${esc(ep.method)}','${esc(ep.path)}',${ep.isDynamic ? "TRUE" : "FALSE"},'${esc(ep.group ?? "")}')`
        );
      }
    } catch {
      /* non-blocking */
    }
  }

  async getLogCount(sessionId: string): Promise<number> {
    if (!this.connected) return 0;
    try {
      const result = await this.execute(
        `SELECT COUNT(*) FROM TRAFFICGHOST.REQUEST_LOGS WHERE SESSION_ID='${esc(sessionId)}'`
      );
      const val = result.rows[0]?.[0];
      return typeof val === "number" ? val : parseInt(String(val ?? "0"), 10);
    } catch {
      return 0;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private handleMessage(msg: Record<string, unknown>): void {
    const [id] = this.pendingResolvers.keys();
    if (id === undefined) return;
    const { resolve, reject } = this.pendingResolvers.get(id)!;
    this.pendingResolvers.delete(id);

    if (msg.status === "ok") {
      resolve(msg);
    } else {
      const exMsg =
        (msg.exception as { text?: string } | undefined)?.text ?? "Exasol error";
      reject(new Error(`Exasol: ${exMsg}`));
    }
  }

  private sendAndWait(payload: Record<string, unknown>): Promise<unknown> {
    if (!this.ws) return Promise.reject(new Error("WebSocket not open"));
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.pendingResolvers.delete(id);
          reject(new Error("Exasol request timed out"));
        }
      }, 15000);

      this.pendingResolvers.set(id, {
        resolve: (v) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            resolve(v);
          }
        },
        reject: (e) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            reject(e);
          }
        },
      });

      this.ws.send(JSON.stringify(payload));
    });
  }

  private encryptPasswordPem(password: string, pem: string): string {
    const encrypted = crypto.publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(password, "utf-8")
    );
    return encrypted.toString("base64");
  }

  private encryptPasswordModExp(
    password: string,
    modHex: string,
    expHex: string
  ): string {
    const modulus = BigInt("0x" + modHex);
    const exponent = BigInt("0x" + expHex);
    const pem = this.buildRsaPublicKeyPem(modulus, exponent);
    const key = crypto.createPublicKey({ key: pem, format: "pem" });
    const encrypted = crypto.publicEncrypt(
      { key, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(password, "utf-8")
    );
    return encrypted.toString("base64");
  }

  private buildRsaPublicKeyPem(modulus: bigint, exponent: bigint): string {
    const encodeBigInt = (n: bigint): Buffer => {
      let hex = n.toString(16);
      if (hex.length % 2) hex = "0" + hex;
      const buf = Buffer.from(hex, "hex");
      return buf[0] & 0x80
        ? Buffer.concat([Buffer.from([0x00]), buf])
        : buf;
    };
    const derLen = (len: number): Buffer => {
      if (len < 128) return Buffer.from([len]);
      const hex = len.toString(16).padStart(2, "0");
      const lenBytes = Buffer.from(hex, "hex");
      return Buffer.concat([Buffer.from([0x80 | lenBytes.length]), lenBytes]);
    };
    const wrap = (tag: number, data: Buffer): Buffer =>
      Buffer.concat([Buffer.from([tag]), derLen(data.length), data]);

    const modBuf = encodeBigInt(modulus);
    const expBuf = encodeBigInt(exponent);
    const inner = wrap(0x30, Buffer.concat([wrap(0x02, modBuf), wrap(0x02, expBuf)]));
    const algoId = Buffer.from("300d06092a864886f70d0101010500", "hex");
    const bitStr = wrap(0x03, Buffer.concat([Buffer.from([0x00]), inner]));
    const spki = wrap(0x30, Buffer.concat([algoId, bitStr]));
    const b64 = spki.toString("base64").match(/.{1,64}/g)!.join("\n");
    return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
  }

  private transposeColumnFirst(
    data: unknown[][],
    numRows: number,
    numCols: number
  ): unknown[][] {
    const rows: unknown[][] = Array.from({ length: numRows }, () =>
      new Array(numCols).fill(null)
    );
    for (let col = 0; col < data.length; col++) {
      const colData = data[col];
      if (!Array.isArray(colData)) continue;
      for (let row = 0; row < colData.length; row++) {
        if (rows[row]) rows[row][col] = colData[row];
      }
    }
    return rows;
  }
}

function esc(s: string): string {
  return s.replace(/'/g, "''").substring(0, 1999);
}
