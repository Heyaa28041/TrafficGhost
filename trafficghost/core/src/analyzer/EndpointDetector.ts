// TrafficGhost — Endpoint Detector
// Groups TrafficRecords into EndpointModels with dynamic segment detection.

import { TrafficRecord, EndpointModel, ResponseExample, BehaviorConfig } from "../models/types.js";
import { randomUUID } from "crypto";

// Heuristics for detecting dynamic path segments:
// A segment is dynamic if it looks like an ID (numeric, UUID, or long hash-like string)
const NUMERIC_RE = /^\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_LIKE_RE = /^[0-9a-zA-Z_-]{8,}$/; // >= 8 chars, no dots (dots indicate file extensions or domains)
// Explicit static keywords — never treat these as dynamic
const STATIC_KEYWORDS = new Set([
  "api", "v1", "v2", "v3", "users", "products", "orders", "login", "logout",
  "auth", "search", "items", "list", "all", "me", "profile", "settings",
  "health", "status", "ping", "metrics", "admin", "public", "private",
  "graphql", "query", "mutation",
]);

function isDynamicSegment(segment: string): boolean {
  if (!segment || STATIC_KEYWORDS.has(segment.toLowerCase())) return false;
  if (NUMERIC_RE.test(segment)) return true;
  if (UUID_RE.test(segment)) return true;
  // Long alphanumeric strings with no dots, not a common word
  if (HASH_LIKE_RE.test(segment) && !/[a-zA-Z]{4,}/.test(segment)) return true;
  return false;
}

function normalizePath(rawPath: string): { normalized: string; params: string[] } {
  const segments = rawPath.split("/").filter(Boolean);
  const params: string[] = [];
  const normalized = segments.map((seg, idx) => {
    if (isDynamicSegment(seg)) {
      // Name by position: id, subId, subSubId, etc.
      const paramName = idx === segments.length - 1 ? "id" : `param${idx}`;
      params.push(paramName);
      return `:${paramName}`;
    }
    return seg;
  });
  return { normalized: "/" + normalized.join("/"), params };
}

function makeEndpointKey(method: string, normalizedPath: string): string {
  return `${method.toUpperCase()}:${normalizedPath}`;
}

function headersToExample(record: TrafficRecord): ResponseExample {
  return {
    status: record.responseStatus,
    headers: record.responseHeaders,
    body: record.responseBody,
    mimeType: record.responseMimeType,
  };
}

export function detectEndpoints(records: TrafficRecord[]): EndpointModel[] {
  // Group records by (method, normalizedPath)
  const byKey = new Map<string, {
    normalized: string;
    method: string;
    params: string[];
    rawPaths: Set<string>;
    examples: ResponseExample[];
  }>();

  for (const record of records) {
    const { normalized, params } = normalizePath(record.path);
    const key = makeEndpointKey(record.method, normalized);

    if (!byKey.has(key)) {
      byKey.set(key, {
        normalized,
        method: record.method,
        params,
        rawPaths: new Set(),
        examples: [],
      });
    }

    const group = byKey.get(key)!;
    group.rawPaths.add(record.path);

    // Store unique response examples (deduplicate by status + body)
    const exampleJson = JSON.stringify({ s: record.responseStatus, b: record.responseBody });
    const alreadyHave = group.examples.some(
      (e) => JSON.stringify({ s: e.status, b: e.body }) === exampleJson
    );
    if (!alreadyHave) {
      group.examples.push(headersToExample(record));
    }
  }

  const defaultBehavior: BehaviorConfig = { latencyMs: 0, errorRates: {} };

  const endpoints: EndpointModel[] = [];
  for (const [, group] of byKey) {
    endpoints.push({
      id: randomUUID(),
      method: group.method,
      path: group.normalized,
      rawPaths: Array.from(group.rawPaths),
      isDynamic: group.params.length > 0,
      dynamicParams: group.params,
      examples: group.examples,
      group: inferGroup(group.normalized),
      behavior: { ...defaultBehavior },
    });
  }

  // Sort: static routes before dynamic, then alphabetically
  endpoints.sort((a, b) => {
    if (a.isDynamic !== b.isDynamic) return a.isDynamic ? 1 : -1;
    return a.path.localeCompare(b.path);
  });

  return endpoints;
}

/** Infer the resource group from the path, e.g. /api/users/:id → "users" */
function inferGroup(normalizedPath: string): string {
  const segments = normalizedPath.split("/").filter((s) => !s.startsWith(":") && s !== "api" && s !== "");
  return segments[0] ?? "misc";
}
