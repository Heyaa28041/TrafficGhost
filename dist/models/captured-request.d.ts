/**
 * Normalized model for network requests captured via HAR or browser recorder.
 */
export interface CapturedRequest {
    id: string;
    method: string;
    url: string;
    protocol?: string;
    host?: string;
    path: string;
    query: Record<string, string | string[]>;
    headers: Record<string, string>;
    body?: unknown;
    contentType?: string;
    response: CapturedResponse;
    timing?: RequestTiming;
    timestamp: number;
}
export interface CapturedResponse {
    status: number;
    statusText?: string;
    headers: Record<string, string>;
    body: unknown;
    contentType?: string;
    contentLength?: number;
    isBase64?: boolean;
}
export interface RequestTiming {
    start: number;
    duration: number;
    dns?: number;
    connect?: number;
    send?: number;
    wait?: number;
    receive?: number;
}
/**
 * Utility to redact sensitive headers
 */
export declare function redactHeaders(headers: Record<string, string>, redactList?: string[]): Record<string, string>;
export declare function detectSensitiveData(req: {
    headers: Record<string, string>;
    body?: any;
    response: {
        headers: Record<string, string>;
        body?: any;
    };
}): boolean;
