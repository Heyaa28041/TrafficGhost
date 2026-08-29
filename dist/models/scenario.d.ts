/**
 * Scenario configurations for TrafficGhost mock engine.
 */
export type ScenarioType = 'normal' | 'slow-network' | 'rate-limited' | 'server-error' | 'not-found' | 'unauthorized' | 'empty-response';
export interface ScenarioDefinition {
    id: ScenarioType;
    name: string;
    description: string;
    statusCode?: number;
    latencyMin?: number;
    latencyMax?: number;
    emptyPayload?: boolean;
}
export declare const BUILTIN_SCENARIOS: Record<ScenarioType, ScenarioDefinition>;
export interface ScenarioRule {
    activeScenario: ScenarioType;
    customStatusCode?: number;
    customLatencyMs?: number;
    errorProbability?: number;
    errorStatusCode?: number;
}
