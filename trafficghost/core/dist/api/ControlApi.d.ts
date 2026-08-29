export declare class ControlApi {
    private app;
    private readonly mockServer;
    private readonly proxy;
    private readonly storage;
    private settings;
    private running;
    private port;
    private traffic;
    private endpoints;
    private mocks;
    private source;
    constructor(workspaceRoot: string);
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    private registerRoutes;
}
//# sourceMappingURL=ControlApi.d.ts.map