// TrafficGhost — Request Matcher
// Matches incoming HTTP requests to MockDefinition entries.
export class RequestMatcher {
    mocks = [];
    load(mocks) {
        this.mocks = mocks;
    }
    getMocks() {
        return this.mocks;
    }
    /**
     * Match an incoming request to a mock definition.
     * Priority: exact path match > parameterized path match.
     */
    match(method, incomingPath) {
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
            if (mock.method !== normalizedMethod || !mock.isDynamic)
                continue;
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
function matchPath(pattern, path) {
    const patternSegments = pattern.split("/").filter(Boolean);
    const pathSegments = path.split("/").filter(Boolean);
    if (patternSegments.length !== pathSegments.length)
        return null;
    const params = {};
    for (let i = 0; i < patternSegments.length; i++) {
        const ps = patternSegments[i];
        const vs = pathSegments[i];
        if (ps.startsWith(":")) {
            params[ps.slice(1)] = decodeURIComponent(vs);
        }
        else if (ps !== vs) {
            return null;
        }
    }
    return params;
}
//# sourceMappingURL=RequestMatcher.js.map