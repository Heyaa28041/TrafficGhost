import { EventEmitter } from 'events';
import { TrafficGhostMockSchema } from '../models/endpoint';
import { TrafficGhostConfig } from '../models/config';
import { GhostStateManager } from './ghost-state-manager';
export interface ServerEventData {
    method: string;
    url: string;
    path: string;
    status: number;
    durationMs: number;
    scenario: string;
    type: 'REST' | 'GRAPHQL' | 'UNKNOWN';
    operationName?: string;
    timestamp: number;
}
export declare class TrafficGhostMockServer extends EventEmitter {
    private app;
    private server;
    private schema;
    private config;
    private isRunning;
    private port;
    private ghostMode;
    private ghostStateManager;
    setGhostMode(enabled: boolean, stateManager?: GhostStateManager): void;
    constructor(schema: TrafficGhostMockSchema, config: TrafficGhostConfig);
    updateSchema(schema: TrafficGhostMockSchema): void;
    updateConfig(config: TrafficGhostConfig): void;
    private setupMiddleware;
    private registerRoutes;
    private registerGraphQLHandlers;
    private registerRestEndpoints;
    private createDemoLoginEndpoint;
    private emitRequestEvent;
    start(): Promise<number>;
    stop(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        port: number;
        routesCount: number;
    };
}
