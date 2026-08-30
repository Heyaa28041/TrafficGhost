// TrafficGhost — Core Type Definitions
// Apache 2.0 — derived from mockserver-monorepo reference

export interface TrafficRecord {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  query: Record<string, string>;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;

  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody?: unknown;
  responseMimeType?: string;

  timing?: {
    startedAt?: number;
    durationMs?: number;
  };

  // Source tagging — does not affect downstream logic
  source?: "har" | "proxy";
}

export interface EndpointModel {
  id: string;
  method: string;
  /** Normalized path with :param segments, e.g. /users/:id */
  path: string;
  /** Original path segments that led to this normalization */
  rawPaths: string[];

  isDynamic: boolean;
  dynamicParams: string[]; // e.g. ['id']

  pagination?: {
    type: "page" | "offset" | "cursor" | "limit";
    paramName: string;
  };

  /** All recorded responses for this endpoint */
  examples: ResponseExample[];

  /** Detected resource group, e.g. "users", "products" */
  group?: string;

  behavior: BehaviorConfig;
}

export interface ResponseExample {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  mimeType?: string;
}

export interface MockDefinition {
  id: string;
  method: string;
  path: string; // Fastify route path, e.g. /api/users/:id
  isDynamic: boolean;

  responses: ResponseExample[];

  behavior: BehaviorConfig;
}

export interface BehaviorConfig {
  latencyMs?: number;          // fixed latency in ms, 0 = none
  latencyRandom?: boolean;     // if true, randomize up to latencyMs
  errorRates?: {
    404?: number;              // 0-1 probability
    429?: number;
    500?: number;
    502?: number;
    503?: number;
  };
}

export interface ExasolConfig {
  host: string;      // default "localhost"
  port: number;      // default 8563
  user: string;      // default "sys"
  password: string;  // default "exasol"
  schema: string;    // default "TRAFFICGHOST"
  aiApiKey?: string; // API key for LLM (Groq, OpenAI, etc.)
  aiEndpoint?: string; // optional custom LLM endpoint
  aiModel?: string;    // optional custom model name
}

export interface GlobalSettings {
  mockPort: number;
  proxyPort: number;
  controlPort: number;
  defaultLatencyMs: number;
  chaosMode: boolean;
  chaosConfig?: BehaviorConfig;
  exasol?: ExasolConfig;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  mockPort: 4000,
  proxyPort: 7777,
  controlPort: 4001,
  defaultLatencyMs: 0,
  chaosMode: false,
  exasol: {
    host: "localhost",
    port: 8563,
    user: "sys",
    password: "exasol",
    schema: "TRAFFICGHOST",
  },
};

export interface RequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  fromMock: boolean;
}

export interface ProjectState {
  source?: string;           // e.g. "demo.har" or "proxy"
  trafficCount: number;
  endpointCount: number;
  dynamicRouteCount: number;
  paginatedEndpointCount: number;
  mockRunning: boolean;
  mockUrl?: string;
  proxyRunning: boolean;
  proxyUrl?: string;
}

export interface AnalysisResult {
  endpoints: EndpointModel[];
  groups: Record<string, EndpointModel[]>;
  stats: {
    totalRequests: number;
    totalEndpoints: number;
    dynamicRoutes: number;
    paginatedEndpoints: number;
  };
}
