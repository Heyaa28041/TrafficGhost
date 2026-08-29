// TrafficGhost — Engine HTTP Client
// Typed wrapper around the Control API on :4001

import * as http from "http";

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  warnings: string[];
}

export interface AnalysisStats {
  totalRequests: number;
  totalEndpoints: number;
  dynamicRoutes: number;
  paginatedEndpoints: number;
}

export interface AnalysisResult {
  stats: AnalysisStats;
}

export interface MockStatus {
  running: boolean;
  port: number | null;
  url: string | null;
  mockCount: number;
}

export interface ProjectState {
  source?: string;
  trafficCount: number;
  endpointCount: number;
  dynamicRouteCount: number;
  paginatedEndpointCount: number;
  mockRunning: boolean;
  mockUrl?: string;
  proxyRunning: boolean;
  proxyUrl?: string;
}

export interface BehaviorConfig {
  latencyMs?: number;
  latencyRandom?: boolean;
  errorRates?: {
    404?: number;
    429?: number;
    500?: number;
  };
}

export class EngineClient {
  private readonly baseUrl: string;

  constructor(port = 4001) {
    this.baseUrl = `http://localhost:${port}`;
  }

  async isReachable(): Promise<boolean> {
    try {
      const res = await this.get<{ ok: boolean }>("/health");
      return res.ok === true;
    } catch {
      return false;
    }
  }

  async getProject(): Promise<ProjectState> {
    return this.get<ProjectState>("/project");
  }

  async importHarFile(filePath: string): Promise<ImportResult> {
    return this.post<ImportResult>("/import/har", { filePath });
  }

  async importHarJson(harJson: string, source?: string): Promise<ImportResult> {
    return this.post<ImportResult>("/import/har-json", { harJson, source });
  }

  async analyze(): Promise<AnalysisResult> {
    return this.post<AnalysisResult>("/analyze", {});
  }

  async generateMocks(): Promise<{ ok: boolean; count: number }> {
    return this.post("/generate", {});
  }

  async startMockServer(port?: number): Promise<{ ok: boolean; port: number; url: string }> {
    return this.post("/mock/start", port ? { port } : {});
  }

  async stopMockServer(): Promise<{ ok: boolean }> {
    return this.post("/mock/stop", {});
  }

  async getMockStatus(): Promise<MockStatus> {
    return this.get<MockStatus>("/mock/status");
  }

  async getRequestLog(): Promise<Array<{ id: string; timestamp: string; method: string; path: string; status: number; durationMs: number }>> {
    return this.get("/mock/logs");
  }

  async startProxy(port?: number): Promise<{ ok: boolean; port: number; url: string }> {
    return this.post("/proxy/start", port ? { port } : {});
  }

  async stopProxy(): Promise<{ ok: boolean }> {
    return this.post("/proxy/stop", {});
  }

  async setBehavior(config: BehaviorConfig): Promise<{ ok: boolean }> {
    return this.put("/behavior", config);
  }

  async setChaosMode(enabled: boolean, config?: BehaviorConfig): Promise<{ ok: boolean }> {
    return this.put("/behavior/chaos", { enabled, config });
  }

  async resetProject(): Promise<{ ok: boolean }> {
    return this.post("/project/reset", {});
  }

  private async get<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = http.get(`${this.baseUrl}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.error ?? `HTTP ${res.statusCode}`));
            } else {
              resolve(parsed as T);
            }
          } catch {
            reject(new Error(`Invalid JSON from engine: ${data.substring(0, 100)}`));
          }
        });
      });
      req.on("error", reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error("Engine request timed out.")); });
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private async request<T>(method: string, path: string, body: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const options: http.RequestOptions = {
        hostname: "localhost",
        port: parseInt(this.baseUrl.split(":")[2]),
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      };
      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.error ?? `HTTP ${res.statusCode}`));
            } else {
              resolve(parsed as T);
            }
          } catch {
            reject(new Error(`Invalid JSON from engine: ${data.substring(0, 100)}`));
          }
        });
      });
      req.on("error", reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error("Engine request timed out.")); });
      req.write(payload);
      req.end();
    });
  }
}
