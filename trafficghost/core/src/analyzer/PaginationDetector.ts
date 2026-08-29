// TrafficGhost — Pagination Detector
// Identifies pagination patterns from TrafficRecord query parameters.

import { TrafficRecord, EndpointModel } from "../models/types.js";

type PaginationType = "page" | "offset" | "cursor" | "limit";

interface PaginationPattern {
  type: PaginationType;
  paramName: string;
}

const PAGINATION_PARAMS: Array<{ names: string[]; type: PaginationType }> = [
  { names: ["page", "p", "pageNumber", "page_number", "pageNum"], type: "page" },
  { names: ["offset", "skip", "from"], type: "offset" },
  { names: ["cursor", "after", "before", "next_cursor", "nextCursor"], type: "cursor" },
  { names: ["limit", "per_page", "perPage", "pageSize", "page_size", "size"], type: "limit" },
];

export function detectPagination(
  records: TrafficRecord[],
  endpoints: EndpointModel[]
): EndpointModel[] {
  // Build a map: normalized path key → queries seen
  const queriesByEndpoint = new Map<string, Array<Record<string, string>>>();
  for (const rec of records) {
    if (Object.keys(rec.query).length === 0) continue;
    const key = `${rec.method}:${rec.path}`;
    if (!queriesByEndpoint.has(key)) queriesByEndpoint.set(key, []);
    queriesByEndpoint.get(key)!.push(rec.query);
  }

  return endpoints.map((endpoint) => {
    const pattern = detectPaginationForEndpoint(endpoint, queriesByEndpoint);
    if (pattern) {
      return { ...endpoint, pagination: pattern };
    }
    return endpoint;
  });
}

function detectPaginationForEndpoint(
  endpoint: EndpointModel,
  queriesByEndpoint: Map<string, Array<Record<string, string>>>
): PaginationPattern | null {
  // Try to find query data for any of the raw paths of this endpoint
  const queries: Array<Record<string, string>> = [];
  for (const rawPath of endpoint.rawPaths) {
    const key = `${endpoint.method}:${rawPath}`;
    const found = queriesByEndpoint.get(key);
    if (found) queries.push(...found);
  }

  if (queries.length < 2) return null; // need multiple requests to detect pagination

  // Check each pagination pattern
  for (const { names, type } of PAGINATION_PARAMS) {
    for (const paramName of names) {
      const valuesWithParam = queries
        .filter((q) => q[paramName] !== undefined)
        .map((q) => q[paramName]);

      if (valuesWithParam.length >= 2) {
        // For page/offset, values should be numerically varying
        if (type === "page" || type === "offset" || type === "limit") {
          const nums = valuesWithParam.map(Number).filter((n) => !isNaN(n));
          if (nums.length >= 2 && new Set(nums).size >= 2) {
            return { type, paramName };
          }
        } else {
          // For cursor, any variation counts
          if (new Set(valuesWithParam).size >= 2) {
            return { type, paramName };
          }
        }
      }
    }
  }

  return null;
}
