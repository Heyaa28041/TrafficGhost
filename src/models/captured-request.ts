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

export function detectSensitiveData(req: { headers: Record<string, string>; body?: any; response: { headers: Record<string, string>; body?: any } }): boolean {
  const sensitiveKeys = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey', 'password', 'token', 'secret'];
  
  // Check request headers
  for (const k of Object.entries(req.headers)) {
    if (sensitiveKeys.includes(k[0].toLowerCase())) return true;
    if (k[1] === '[REDACTED]') return true;
  }
  
  // Check response headers
  for (const k of Object.entries(req.response.headers)) {
    if (sensitiveKeys.includes(k[0].toLowerCase())) return true;
    if (k[1] === '[REDACTED]') return true;
  }

  // Check request body keys
  if (req.body && typeof req.body === 'object') {
    const keys = Object.keys(req.body);
    for (const k of keys) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) return true;
    }
  }

  // Check response body keys
  if (req.response.body && typeof req.response.body === 'object') {
    const keys = Object.keys(req.response.body);
    for (const k of keys) {
      if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) return true;
    }
  }

  return false;
}
