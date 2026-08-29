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
  duration: number; // in milliseconds
  dns?: number;
  connect?: number;
  send?: number;
  wait?: number;
  receive?: number;
}

/**
 * Utility to redact sensitive headers
 */
export function redactHeaders(
  headers: Record<string, string>,
  redactList: string[] = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey', 'proxy-authorization']
): Record<string, string> {
  const result: Record<string, string> = {};
  const lowerRedact = new Set(redactList.map((h) => h.toLowerCase()));

  for (const [key, value] of Object.entries(headers)) {
    if (lowerRedact.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}
