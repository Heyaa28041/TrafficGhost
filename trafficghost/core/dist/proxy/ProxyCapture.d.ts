import { TrafficRecord } from "../models/types.js";
export type TrafficCallback = (record: TrafficRecord) => void;
export declare class ProxyCapture {
    private server;
    private port;
    private running;
    private onTraffic;
    constructor(onTraffic: TrafficCallback);
    isRunning(): boolean;
    getPort(): number;
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    private handleRequest;
}
//# sourceMappingURL=ProxyCapture.d.ts.map