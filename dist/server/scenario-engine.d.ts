import { ScenarioType } from '../models/scenario';
import { RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';
export interface EvaluatedBehavior {
    statusCode: number;
    delayMs: number;
    emptyPayload: boolean;
    scenarioApplied: ScenarioType;
    customHeaders?: Record<string, string>;
}
export declare class ScenarioEngine {
    /**
     * Evaluates the behavior (status code, delay, headers, empty state)
     * for an incoming request against global and endpoint-level scenario rules.
     */
    static evaluateBehavior(globalScenario: ScenarioType, globalLatency: {
        enabled: boolean;
        min: number;
        max: number;
    }, endpoint?: RestEndpointDefinition | GraphQLEndpointDefinition): EvaluatedBehavior;
    /**
     * Applies the calculated latency delay.
     */
    static applyLatency(delayMs: number): Promise<void>;
    /**
     * Returns a standard error body payload for error status codes.
     */
    static createErrorResponse(statusCode: number, message?: string): Record<string, unknown>;
}
