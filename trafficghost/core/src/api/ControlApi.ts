// TrafficGhost — Control API
// Fastify HTTP API on :4001 that the VS Code extension uses to control the engine.

import Fastify, { FastifyInstance } from "fastify";
import * as fs from "fs";
import * as path from "path";
import { parseHar } from "../har/HarParser.js";
import { detectEndpoints } from "../analyzer/EndpointDetector.js";
import { detectPagination } from "../analyzer/PaginationDetector.js";
import { generateMocks } from "../generator/MockGenerator.js";
import { MockServer } from "../server/MockServer.js";
import { ProxyCapture } from "../proxy/ProxyCapture.js";
import { FileStorage } from "../storage/FileStorage.js";
import {
  TrafficRecord,
  EndpointModel,
  MockDefinition,
  BehaviorConfig,
  AnalysisResult,
  ProjectState,
  GlobalSettings,
  DEFAULT_SETTINGS,
} from "../models/types.js";

export class ControlApi {
  private app: FastifyInstance | null = null;
  private readonly mockServer: MockServer;
  private readonly proxy: ProxyCapture;
  private readonly storage: FileStorage;
  private settings: GlobalSettings;
  private running = false;
  private port = 4001;

  // In-memory state (backed by storage)
  private traffic: TrafficRecord[] = [];
  private endpoints: EndpointModel[] = [];
  private mocks: MockDefinition[] = [];
  private source: string | undefined;

  constructor(workspaceRoot: string) {
    this.storage = new FileStorage(workspaceRoot);
    this.settings = this.storage.loadSettings();

    this.mockServer = new MockServer();

    this.proxy = new ProxyCapture((record: TrafficRecord) => {
      this.traffic.push(record);
      // Auto-save proxy traffic
      this.storage.saveTraffic(this.traffic);
    });

    // Restore persisted state on startup
    this.traffic = this.storage.loadTraffic();
    this.endpoints = this.storage.loadEndpoints();
    this.mocks = this.storage.loadMocks();
    const project = this.storage.loadProject();
    this.source = (project["source"] as string) ?? undefined;
  }

  async start(port = 4001): Promise<void> {
    if (this.running) return;
    this.port = port;
    this.app = Fastify({ logger: false });

    this.app.addHook("onSend", async (_req, reply) => {
      reply.header("Access-Control-Allow-Origin", "*");
      reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      reply.header("Access-Control-Allow-Headers", "Content-Type");
    });
    this.app.options("*", async (_req, reply) => reply.status(204).send());

    this.registerRoutes();
    await this.app.listen({ port, host: "127.0.0.1" });
    this.running = true;
    console.log(`[TrafficGhost] Control API running on http://localhost:${port}`);
  }

  async stop(): Promise<void> {
    if (!this.running || !this.app) return;
    if (this.mockServer.isRunning()) {
      try { await this.mockServer.stop(); } catch {}
    }
    if (this.proxy.isRunning()) {
      try { await this.proxy.stop(); } catch {}
    }
    await this.app.close();
    this.app = null;
    this.running = false;
  }

  private registerRoutes(): void {
    const app = this.app!;

    // Health check
    app.get("/health", async () => ({ ok: true, version: "1.0.0" }));

    // ─── Import ──────────────────────────────────────────────────────────────

    // Import from HAR file path
    app.post<{ Body: { filePath: string } }>("/import/har", async (req, reply) => {
      const { filePath } = req.body;
      if (!filePath) return reply.status(400).send({ error: "filePath is required." });
      if (!fs.existsSync(filePath)) return reply.status(404).send({ error: `File not found: ${filePath}` });

      const raw = fs.readFileSync(filePath, "utf-8");
      const result = parseHar(raw);
      this.traffic = result.records;
      this.source = require("path").basename(filePath);
      this.endpoints = [];
      this.mocks = [];
      this.storage.saveTraffic(this.traffic);
      this.storage.saveProject({ source: this.source });

      return {
        ok: true,
        imported: result.records.length,
        skipped: result.skipped,
        warnings: result.errors.slice(0, 5),
      };
    });

    // Import raw HAR JSON (body = { harJson: string })
    app.post<{ Body: { harJson: string; source?: string } }>("/import/har-json", async (req, reply) => {
      const { harJson, source } = req.body;
      if (!harJson) return reply.status(400).send({ error: "harJson is required." });

      const result = parseHar(harJson);
      this.traffic = result.records;
      this.source = source ?? "uploaded.har";
      this.endpoints = [];
      this.mocks = [];
      this.storage.saveTraffic(this.traffic);
      this.storage.saveProject({ source: this.source });

      return {
        ok: true,
        imported: result.records.length,
        skipped: result.skipped,
        warnings: result.errors.slice(0, 5),
      };
    });

    // ─── Analyze ─────────────────────────────────────────────────────────────

    app.post("/analyze", async (_req, reply) => {
      if (this.traffic.length === 0) {
        return reply.status(400).send({ error: "No traffic recorded. Import a HAR file or start the proxy first." });
      }

      let endpoints = detectEndpoints(this.traffic);
      endpoints = detectPagination(this.traffic, endpoints);

      this.endpoints = endpoints;
      this.storage.saveEndpoints(endpoints);

      const groups: Record<string, EndpointModel[]> = {};
      for (const ep of endpoints) {
        const g = ep.group ?? "misc";
        if (!groups[g]) groups[g] = [];
        groups[g].push(ep);
      }

      const result: AnalysisResult = {
        endpoints,
        groups,
        stats: {
          totalRequests: this.traffic.length,
          totalEndpoints: endpoints.length,
          dynamicRoutes: endpoints.filter((e) => e.isDynamic).length,
          paginatedEndpoints: endpoints.filter((e) => e.pagination).length,
        },
      };

      return result;
    });

    // ─── Generate ─────────────────────────────────────────────────────────────

    app.post("/generate", async (_req, reply) => {
      if (this.endpoints.length === 0) {
        return reply.status(400).send({ error: "No endpoints analyzed. Run /analyze first." });
      }
      this.mocks = generateMocks(this.endpoints);
      this.storage.saveMocks(this.mocks);
      return { ok: true, count: this.mocks.length };
    });

    // ─── Mock Server ──────────────────────────────────────────────────────────

    app.post<{ Body?: { port?: number } }>("/mock/start", async (req, reply) => {
      if (this.mocks.length === 0) {
        return reply.status(400).send({ error: "No mocks generated. Run /generate first." });
      }
      if (this.mockServer.isRunning()) {
        return { ok: true, already: true, port: this.mockServer.getPort() };
      }
      const port = req.body?.port ?? this.settings.mockPort;
      try {
        await this.mockServer.start(this.mocks, port);
        return { ok: true, port, url: `http://localhost:${port}` };
      } catch (e) {
        return reply.status(500).send({ error: (e as Error).message });
      }
    });

    app.post("/mock/stop", async (_req, reply) => {
      if (!this.mockServer.isRunning()) {
        return reply.status(400).send({ error: "Mock server is not running." });
      }
      await this.mockServer.stop();
      return { ok: true };
    });

    app.get("/mock/status", async () => ({
      running: this.mockServer.isRunning(),
      port: this.mockServer.isRunning() ? this.mockServer.getPort() : null,
      url: this.mockServer.isRunning() ? `http://localhost:${this.mockServer.getPort()}` : null,
      mockCount: this.mockServer.getMatcher().getMocks().length,
    }));

    app.get("/mock/logs", async () => this.mockServer.getLog());

    // ─── Behavior ─────────────────────────────────────────────────────────────

    app.put<{ Body: BehaviorConfig }>("/behavior", async (req) => {
      this.mockServer.getBehavior().setGlobalBehavior(req.body);
      return { ok: true };
    });

    app.put<{ Body: { enabled: boolean; config?: BehaviorConfig } }>("/behavior/chaos", async (req) => {
      this.mockServer.getBehavior().setChaosMode(req.body.enabled, req.body.config);
      return { ok: true, chaosMode: req.body.enabled };
    });

    // ─── Proxy ────────────────────────────────────────────────────────────────

    app.post<{ Body?: { port?: number } }>("/proxy/start", async (req, reply) => {
      if (this.proxy.isRunning()) {
        return { ok: true, already: true, port: this.proxy.getPort() };
      }
      const port = req.body?.port ?? this.settings.proxyPort;
      try {
        await this.proxy.start(port);
        return { ok: true, port, url: `http://localhost:${port}` };
      } catch (e) {
        return reply.status(500).send({ error: (e as Error).message });
      }
    });

    app.post("/proxy/stop", async (_req, reply) => {
      if (!this.proxy.isRunning()) return reply.status(400).send({ error: "Proxy is not running." });
      await this.proxy.stop();
      return { ok: true };
    });

    app.get("/proxy/status", async () => ({
      running: this.proxy.isRunning(),
      port: this.proxy.isRunning() ? this.proxy.getPort() : null,
    }));

    // ─── Project State ────────────────────────────────────────────────────────

    app.get("/project", async (): Promise<ProjectState> => ({
      source: this.source,
      trafficCount: this.traffic.length,
      endpointCount: this.endpoints.length,
      dynamicRouteCount: this.endpoints.filter((e) => e.isDynamic).length,
      paginatedEndpointCount: this.endpoints.filter((e) => e.pagination).length,
      mockRunning: this.mockServer.isRunning(),
      mockUrl: this.mockServer.isRunning() ? `http://localhost:${this.mockServer.getPort()}` : undefined,
      proxyRunning: this.proxy.isRunning(),
      proxyUrl: this.proxy.isRunning() ? `http://localhost:${this.proxy.getPort()}` : undefined,
    }));

    app.get("/endpoints", async () => this.endpoints);

    app.post("/project/reset", async () => {
      if (this.mockServer.isRunning()) await this.mockServer.stop();
      if (this.proxy.isRunning()) await this.proxy.stop();
      this.traffic = [];
      this.endpoints = [];
      this.mocks = [];
      this.source = undefined;
      this.storage.reset();
      return { ok: true };
    });

    // Settings
    app.get("/settings", async () => this.settings);
    app.put<{ Body: Partial<GlobalSettings> }>("/settings", async (req) => {
      this.settings = { ...this.settings, ...req.body };
      this.storage.saveSettings(this.settings);
      return { ok: true, settings: this.settings };
    });
  }
}
