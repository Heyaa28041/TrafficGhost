// TrafficGhost — Request Matcher
// Matches incoming HTTP requests to MockDefinition entries.

import { MockDefinition } from "../models/types.js";

export interface MatchResult {
  mock: MockDefinition;
  pathParams: Record<string, string>;
}

export class RequestMatcher {
  private mocks: MockDefinition[] = [];

  load(mocks: MockDefinition[]): void {
    this.mocks = mocks;
  }

  getMocks(): MockDefinition[] {
    return this.mocks;
  }

  /**
   * Match an incoming request to a mock definition.
   * Priority: exact path match > parameterized path match.
   */
  match(method: string, incomingPath: string): MatchResult | null {
    const normalizedMethod = method.toUpperCase();

    // Strip query string if present
    const pathOnly = incomingPath.split("?")[0];

    // 1. Exact static match
    for (const mock of this.mocks) {
      if (mock.method === normalizedMethod && !mock.isDynamic && mock.path === pathOnly) {
        return { mock, pathParams: {} };
      }
    }

    // 2. Parameterized match
    for (const mock of this.mocks) {
      if (mock.method !== normalizedMethod || !mock.isDynamic) continue;
      const pathParams = matchPath(mock.path, pathOnly);
      if (pathParams !== null) {
        return { mock, pathParams };
      }
    }

    return null;
  }
}

/**
 * Match a Fastify-style route pattern against an incoming path.
 * Returns extracted params or null on no-match.
 * e.g. pattern=/users/:id, path=/users/123 → { id: "123" }
 */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = path.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const ps = patternSegments[i];
    const vs = pathSegments[i];
    if (ps.startsWith(":")) {
      params[ps.slice(1)] = decodeURIComponent(vs);
    } else if (ps !== vs) {
      return null;
    }
  }
  return params;
}
