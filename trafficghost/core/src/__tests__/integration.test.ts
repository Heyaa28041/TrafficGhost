import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { parseHar } from "../har/HarParser.js";
import { detectEndpoints } from "../analyzer/EndpointDetector.js";
import { detectPagination } from "../analyzer/PaginationDetector.js";
import { generateMocks } from "../generator/MockGenerator.js";
import { MockServer } from "../server/MockServer.js";
import { RequestMatcher } from "../matcher/RequestMatcher.js";

const TEST_PORT = 14001;

const DEMO_HAR = JSON.stringify({
  log: {
    entries: [
      {
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 50,
        request: { method: "GET", url: "http://localhost:3000/api/users", headers: [], queryString: [] },
        response: { status: 200, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ users: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }] }) } },
      },
      {
        startedDateTime: "2024-01-01T00:00:01Z",
        time: 40,
        request: { method: "GET", url: "http://localhost:3000/api/users?page=1", headers: [], queryString: [{ name: "page", value: "1" }] },
        response: { status: 200, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ users: [{ id: 1, name: "Alice" }], page: 1 }) } },
      },
      {
        startedDateTime: "2024-01-01T00:00:02Z",
        time: 38,
        request: { method: "GET", url: "http://localhost:3000/api/users?page=2", headers: [], queryString: [{ name: "page", value: "2" }] },
        response: { status: 200, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ users: [{ id: 2, name: "Bob" }], page: 2 }) } },
      },
      {
        startedDateTime: "2024-01-01T00:00:03Z",
        time: 35,
        request: { method: "GET", url: "http://localhost:3000/api/users/101", headers: [], queryString: [] },
        response: { status: 200, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ id: 101, name: "Alice" }) } },
      },
      {
        startedDateTime: "2024-01-01T00:00:04Z",
        time: 32,
        request: { method: "GET", url: "http://localhost:3000/api/users/102", headers: [], queryString: [] },
        response: { status: 200, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ id: 102, name: "Bob" }) } },
      },
      {
        startedDateTime: "2024-01-01T00:00:05Z",
        time: 60,
        request: { method: "POST", url: "http://localhost:3000/api/login", headers: [{ name: "content-type", value: "application/json" }], queryString: [], postData: { mimeType: "application/json", text: JSON.stringify({ username: "alice", password: "secret" }) } },
        response: { status: 200, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ token: "eyJhbGciOiJIUzI1NiJ9.abc" }) } },
      },
      {
        startedDateTime: "2024-01-01T00:00:06Z",
        time: 25,
        request: { method: "POST", url: "http://localhost:3000/api/login", headers: [{ name: "content-type", value: "application/json" }], queryString: [], postData: { mimeType: "application/json", text: JSON.stringify({ username: "alice", password: "wrong" }) } },
        response: { status: 401, headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: JSON.stringify({ error: "Unauthorized" }) } },
      },
    ],
  },
});

describe("Integration: HAR → Analyze → Generate → MockServer", () => {
  const server = new MockServer();

  beforeAll(async () => {
    const { records } = parseHar(DEMO_HAR);
    let endpoints = detectEndpoints(records);
    endpoints = detectPagination(records, endpoints);
    const mocks = generateMocks(endpoints);
    await server.start(mocks, TEST_PORT);
  });

  afterAll(async () => {
    if (server.isRunning()) await server.stop();
  });

  it("serves GET /api/users with 200", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/users`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("users");
  });

  it("serves GET /api/users/:id with 200", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/users/999`);
    expect(res.status).toBe(200);
  });

  it("serves POST /api/login with 200", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 for unregistered routes", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("has CORS headers", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/users`);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("RequestMatcher", () => {
  it("matches exact static route", () => {
    const matcher = new RequestMatcher();
    matcher.load([{ id: "1", method: "GET", path: "/api/users", isDynamic: false, responses: [], behavior: {} }]);
    const result = matcher.match("GET", "/api/users");
    expect(result).not.toBeNull();
    expect(result?.pathParams).toEqual({});
  });

  it("matches parameterized route with extraction", () => {
    const matcher = new RequestMatcher();
    matcher.load([{ id: "2", method: "GET", path: "/api/users/:id", isDynamic: true, responses: [], behavior: {} }]);
    const result = matcher.match("GET", "/api/users/123");
    expect(result).not.toBeNull();
    expect(result?.pathParams).toEqual({ id: "123" });
  });

  it("returns null for no match", () => {
    const matcher = new RequestMatcher();
    matcher.load([{ id: "1", method: "GET", path: "/api/users", isDynamic: false, responses: [], behavior: {} }]);
    expect(matcher.match("GET", "/api/products")).toBeNull();
    expect(matcher.match("POST", "/api/users")).toBeNull();
  });

  it("prefers static over dynamic match", () => {
    const matcher = new RequestMatcher();
    matcher.load([
      { id: "1", method: "GET", path: "/api/users/me", isDynamic: false, responses: [], behavior: {} },
      { id: "2", method: "GET", path: "/api/users/:id", isDynamic: true, responses: [], behavior: {} },
    ]);
    const result = matcher.match("GET", "/api/users/me");
    expect(result?.mock.path).toBe("/api/users/me");
  });
});
