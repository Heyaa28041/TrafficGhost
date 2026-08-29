import { describe, it, expect } from "vitest";
import { detectEndpoints } from "../analyzer/EndpointDetector.js";
import { detectPagination } from "../analyzer/PaginationDetector.js";
import { TrafficRecord } from "../models/types.js";
import { randomUUID } from "crypto";

function makeRecord(method: string, url: string, status = 200, query: Record<string, string> = {}): TrafficRecord {
  const parsed = new URL(url);
  return {
    id: randomUUID(),
    method,
    url,
    host: parsed.hostname,
    path: parsed.pathname,
    query,
    requestHeaders: {},
    responseStatus: status,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { ok: true },
    source: "har",
  };
}

describe("EndpointDetector", () => {
  it("groups static routes correctly", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/users"),
      makeRecord("GET", "https://api.example.com/api/users"),
      makeRecord("POST", "https://api.example.com/api/users"),
    ];
    const endpoints = detectEndpoints(records);
    expect(endpoints).toHaveLength(2);
    const methods = endpoints.map((e) => e.method);
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
  });

  it("detects numeric dynamic segments", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/users/101"),
      makeRecord("GET", "https://api.example.com/api/users/102"),
      makeRecord("GET", "https://api.example.com/api/users/999"),
    ];
    const endpoints = detectEndpoints(records);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].path).toBe("/api/users/:id");
    expect(endpoints[0].isDynamic).toBe(true);
    expect(endpoints[0].dynamicParams).toContain("id");
  });

  it("detects UUID dynamic segments", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/items/550e8400-e29b-41d4-a716-446655440000"),
      makeRecord("GET", "https://api.example.com/items/6ba7b810-9dad-11d1-80b4-00c04fd430c8"),
    ];
    const endpoints = detectEndpoints(records);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].isDynamic).toBe(true);
  });

  it("does not treat known static keywords as dynamic", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/users"),
      makeRecord("GET", "https://api.example.com/api/products"),
    ];
    const endpoints = detectEndpoints(records);
    expect(endpoints).toHaveLength(2);
    expect(endpoints.every((e) => !e.isDynamic)).toBe(true);
  });

  it("preserves multiple response examples", () => {
    const records = [
      makeRecord("POST", "https://api.example.com/api/login", 200),
      makeRecord("POST", "https://api.example.com/api/login", 401),
    ];
    // Manually set different bodies to ensure deduplication works
    records[0].responseBody = { token: "abc" };
    records[1].responseBody = { error: "Unauthorized" };

    const endpoints = detectEndpoints(records);
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].examples).toHaveLength(2);
  });

  it("orders static routes before dynamic routes", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/users/123"),
      makeRecord("GET", "https://api.example.com/api/users"),
    ];
    const endpoints = detectEndpoints(records);
    expect(endpoints[0].isDynamic).toBe(false);
    expect(endpoints[1].isDynamic).toBe(true);
  });
});

describe("PaginationDetector", () => {
  it("detects page-based pagination", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/users?page=1", 200, { page: "1" }),
      makeRecord("GET", "https://api.example.com/api/users?page=2", 200, { page: "2" }),
      makeRecord("GET", "https://api.example.com/api/users?page=3", 200, { page: "3" }),
    ];
    const endpoints = detectEndpoints(records);
    const enriched = detectPagination(records, endpoints);
    expect(enriched[0].pagination?.type).toBe("page");
    expect(enriched[0].pagination?.paramName).toBe("page");
  });

  it("detects offset-based pagination", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/products?offset=0", 200, { offset: "0" }),
      makeRecord("GET", "https://api.example.com/api/products?offset=20", 200, { offset: "20" }),
    ];
    const endpoints = detectEndpoints(records);
    const enriched = detectPagination(records, endpoints);
    expect(enriched[0].pagination?.type).toBe("offset");
  });

  it("does not falsely detect pagination with only one request", () => {
    const records = [
      makeRecord("GET", "https://api.example.com/api/users?page=1", 200, { page: "1" }),
    ];
    const endpoints = detectEndpoints(records);
    const enriched = detectPagination(records, endpoints);
    expect(enriched[0].pagination).toBeUndefined();
  });
});
