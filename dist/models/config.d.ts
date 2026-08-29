import { ScenarioType } from './scenario';
/**
 * TrafficGhost Project Configuration stored in trafficghost/config.json
 */
export interface TrafficGhostConfig {
    version: string;
    port: number;
    globalScenario: ScenarioType;
    latency: {
        enabled: boolean;
        min: number;
        max: number;
    };
    pagination: {
        enabled: boolean;
    };
    errors: {
        enabled: boolean;
    };
    redactHeaders: string[];
}
export declare const DEFAULT_CONFIG: TrafficGhostConfig;
