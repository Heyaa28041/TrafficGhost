import { MockDefinition, RequestLogEntry } from "../models/types.js";
import { BehaviorEngine } from "../behavior/BehaviorEngine.js";
import { RequestMatcher } from "../matcher/RequestMatcher.js";
export declare class MockServer {
    private app;
    private readonly matcher;
    private readonly behavior;
    private readonly log;
    private readonly sseClients;
    private running;
    private port;
    getBehavior(): BehaviorEngine;
    getMatcher(): RequestMatcher;
    getLog(): RequestLogEntry[];
    isRunning(): boolean;
    getPort(): number;
    start(mocks: MockDefinition[], port?: number): Promise<void>;
    stop(): Promise<void>;
    private recordLog;
    private broadcastLog;
}
//# sourceMappingURL=MockServer.d.ts.map