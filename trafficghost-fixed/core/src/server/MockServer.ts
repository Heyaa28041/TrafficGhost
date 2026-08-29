// TrafficGhost — Mock HTTP Server
// Fastify-based server on :4000 that serves recorded API responses with behavior injection.

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { MockDefinition, RequestLogEntry } from "../models/types.js";
import { BehaviorEngine } from "../behavior/BehaviorEngine.js";
import { RequestMatcher } from "../matcher/RequestMatcher.js";
import { randomUUID } from "crypto";

const MAX_LOG_ENTRIES = 200;

export class MockServer {
  private app: FastifyInstance | null = null;
  private readonly matcher = new RequestMatcher();
  private readonly behavior = new BehaviorEngine();
  private readonly log: RequestLogEntry[] = [];
  private readonly sseClients = new Set<FastifyReply>();
  private running = false;
  private port = 4000;

  getBehavior(): BehaviorEngine {
    return this.behavior;
  }

  getMatcher(): RequestMatcher {
    return this.matcher;
  }

  getLog(): RequestLogEntry[] {
    return this.log;
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }

  async start(mocks: MockDefinition[], port = 4000): Promise<void> {
    if (this.running) {
      throw new Error(`Mock server is already running on port ${this.port}.`);
    }

    this.port = port;
    this.matcher.load(mocks);

    this.app = Fastify({ logger: false });

    // CORS — allow all origins for local dev
    this.app.addHook("onSend", async (_req, reply) => {
      reply.header("Access-Control-Allow-Origin", "*");
      reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    });

    // SSE endpoint for real-time request log
    this.app.get("/__trafficghost/logs/stream", async (req, reply) => {
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Access-Control-Allow-Origin", "*");
      reply.raw.flushHeaders();
      this.sseClients.add(reply);
      req.raw.on("close", () => {
        this.sseClients.delete(reply);
      });
      // Keep connection alive
      const keepAlive = setInterval(() => {
        reply.raw.write(": ping\n\n");
      }, 15000);
      req.raw.on("close", () => clearInterval(keepAlive));
      // Never resolve — SSE stays open
      await new Promise(() => {});
    });

    // Catch-all route for mock request handling (also serves OPTIONS preflight)
    this.app.all("*", async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.method === "OPTIONS") {
        reply.status(204).send();
        return;
      }

      const start = Date.now();
      const { method, url } = req;

      const matchResult = this.matcher.match(method, url);

      if (!matchResult) {
        const entry = this.recordLog(method, url, 404, Date.now() - start);
        reply.status(404).send({ error: "Not Found", message: `No mock registered for ${method} ${url}` });
        this.broadcastLog(entry);
        return;
      }

      const { mock } = matchResult;
      const { response, appliedLatencyMs } = await this.behavior.applyBehavior(mock);

      // Set response headers from recording
      for (const [k, v] of Object.entries(response.headers)) {
        if (!["transfer-encoding", "content-encoding"].includes(k.toLowerCase())) {
          reply.header(k, v);
        }
      }

      const durationMs = Date.now() - start;
      const entry = this.recordLog(method, url, response.status, durationMs);
      this.broadcastLog(entry);

      if (process.env.DEBUG_TRAFFICGHOST) {
        console.log(`[TrafficGhost] ${method} ${url} → ${response.status} (${durationMs}ms, latency=${appliedLatencyMs}ms)`);
      }

      reply.status(response.status).send(response.body ?? "");
    });

    await this.app.listen({ port, host: "0.0.0.0" });
    this.running = true;
    console.log(`[TrafficGhost] Mock server running on http://localhost:${port}`);
  }

  async stop(): Promise<void> {
    if (!this.running || !this.app) {
      throw new Error("Mock server is not running.");
    }
    await this.app.close();
    this.app = null;
    this.running = false;
    this.sseClients.clear();
    console.log("[TrafficGhost] Mock server stopped.");
  }

  private recordLog(method: string, path: string, status: number, durationMs: number): RequestLogEntry {
    const entry: RequestLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      durationMs,
      fromMock: true,
    };
    this.log.unshift(entry);
    if (this.log.length > MAX_LOG_ENTRIES) this.log.pop();
    return entry;
  }

  private broadcastLog(entry: RequestLogEntry): void {
    const data = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.raw.write(data);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }
}
