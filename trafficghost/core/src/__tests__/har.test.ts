import { describe, it, expect } from "vitest";
import { parseHar } from "../har/HarParser.js";

const MINIMAL_HAR = JSON.stringify({
  log: {
    entries: [
      {
        startedDateTime: "2024-01-01T00:00:00Z",
        time: 123,
        request: {
          method: "GET",
          url: "https://api.example.com/users",
          headers: [{ name: "Content-Type", value: "application/json" }],
          queryString: [],
        },
        response: {
          status: 200,
          headers: [{ name: "Content-Type", value: "application/json" }],
          content: {
            mimeType: "application/json",
            text: JSON.stringify({ users: [{ id: 1, name: "Alice" }] }),
          },
        },
      },
    ],
  },
});

describe("HarParser", () => {
  it("parses a valid HAR file", () => {
    const result = parseHar(MINIMAL_HAR);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].method).toBe("GET");
    expect(result.records[0].path).toBe("/users");
    expect(result.records[0].responseStatus).toBe(200);
    expect(result.skipped).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseHar("not-json")).toThrow("Invalid JSON");
  });

  it("throws on missing log.entries", () => {
    expect(() => parseHar(JSON.stringify({ log: {} }))).toThrow("no log.entries");
  });

  it("throws on empty entries array", () => {
    expect(() => parseHar(JSON.stringify({ log: { entries: [] } }))).toThrow("no HTTP entries");
  });

  it("skips static asset URLs", () => {
    const har = JSON.stringify({
      log: {
        entries: [
          {
            request: { method: "GET", url: "https://api.example.com/style.css", headers: [], queryString: [] },
            response: { status: 200, headers: [], content: { mimeType: "text/css", text: "body{}" } },
          },
          {
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 10,
            request: { method: "GET", url: "https://api.example.com/api/users", headers: [], queryString: [] },
            response: { status: 200, headers: [], content: { mimeType: "application/json", text: "[]" } },
          },
        ],
      },
    });
    const result = parseHar(har);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].path).toBe("/api/users");
    expect(result.skipped).toBe(1);
  });

  it("parses query string correctly", () => {
    const har = JSON.stringify({
      log: {
        entries: [
          {
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 50,
            request: {
              method: "GET",
              url: "https://api.example.com/users?page=2&limit=10",
              headers: [],
              queryString: [{ name: "page", value: "2" }, { name: "limit", value: "10" }],
            },
            response: { status: 200, headers: [], content: { mimeType: "application/json", text: "[]" } },
          },
        ],
      },
    });
    const result = parseHar(har);
    expect(result.records[0].query).toEqual({ page: "2", limit: "10" });
  });

  it("parses base64 encoded response body", () => {
    const encoded = Buffer.from('{"ok":true}').toString("base64");
    const har = JSON.stringify({
      log: {
        entries: [
          {
            startedDateTime: "2024-01-01T00:00:00Z",
            time: 10,
            request: { method: "POST", url: "https://api.example.com/login", headers: [], queryString: [] },
            response: {
              status: 200,
              headers: [],
              content: { mimeType: "application/json", text: encoded, encoding: "base64" },
            },
          },
        ],
      },
    });
    const result = parseHar(har);
    expect(result.records[0].responseBody).toEqual({ ok: true });
  });
});
