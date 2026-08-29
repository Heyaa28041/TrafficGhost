import { EventEmitter } from 'events';
import { ServerEventData } from './mock-server';
import { TrafficGhostMockSchema } from '../models/endpoint';
import { TrafficGhostConfig } from '../models/config';
import { ScenarioType } from '../models/scenario';
export declare class ServerManager extends EventEmitter {
    private static instance;
    private mockServer;
    private currentSchema;
    private currentConfig;
    private requestHistory;
    private constructor();
    static getInstance(): ServerManager;
    setSchema(schema: TrafficGhostMockSchema): void;
    getSchema(): TrafficGhostMockSchema;
    setConfig(config: TrafficGhostConfig): void;
    getConfig(): TrafficGhostConfig;
    setGlobalScenario(scenario: ScenarioType): void;
    startServer(port?: number): Promise<number>;
    stopServer(): Promise<void>;
    isRunning(): boolean;
    getPort(): number;
    getRequestHistory(): ServerEventData[];
    clearRequestHistory(): void;
}
