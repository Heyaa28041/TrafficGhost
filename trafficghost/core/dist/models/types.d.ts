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
    dynamicParams: string[];
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
    path: string;
    isDynamic: boolean;
    responses: ResponseExample[];
    behavior: BehaviorConfig;
}
export interface BehaviorConfig {
    latencyMs?: number;
    latencyRandom?: boolean;
    errorRates?: {
        404?: number;
        429?: number;
        500?: number;
        502?: number;
        503?: number;
    };
}
export interface GlobalSettings {
    mockPort: number;
    proxyPort: number;
    controlPort: number;
    defaultLatencyMs: number;
    chaosMode: boolean;
    chaosConfig?: BehaviorConfig;
}
export declare const DEFAULT_SETTINGS: GlobalSettings;
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
//# sourceMappingURL=types.d.ts.map