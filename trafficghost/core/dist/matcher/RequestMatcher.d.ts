import { MockDefinition } from "../models/types.js";
export interface MatchResult {
    mock: MockDefinition;
    pathParams: Record<string, string>;
}
export declare class RequestMatcher {
    private mocks;
    load(mocks: MockDefinition[]): void;
    getMocks(): MockDefinition[];
    /**
     * Match an incoming request to a mock definition.
     * Priority: exact path match > parameterized path match.
     */
    match(method: string, incomingPath: string): MatchResult | null;
}
//# sourceMappingURL=RequestMatcher.d.ts.map