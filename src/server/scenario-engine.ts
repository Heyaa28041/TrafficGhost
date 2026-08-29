import { ScenarioType, BUILTIN_SCENARIOS, ScenarioRule } from '../models/scenario';
import { RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';

export interface EvaluatedBehavior {
  statusCode: number;
  delayMs: number;
  emptyPayload: boolean;
  scenarioApplied: ScenarioType;
  customHeaders?: Record<string, string>;
}

export class ScenarioEngine {
  /**
   * Evaluates the behavior (status code, delay, headers, empty state)
   * for an incoming request against global and endpoint-level scenario rules.
   */
  public static evaluateBehavior(
    globalScenario: ScenarioType,
    globalLatency: { enabled: boolean; min: number; max: number },
    endpoint?: RestEndpointDefinition | GraphQLEndpointDefinition
  ): EvaluatedBehavior {
    // Determine active scenario: endpoint override or global
    const rule: ScenarioRule | undefined = endpoint?.scenarioRule;
    const activeScenario: ScenarioType = rule?.activeScenario || globalScenario || 'normal';
    const def = BUILTIN_SCENARIOS[activeScenario] || BUILTIN_SCENARIOS['normal'];

    let statusCode = def.statusCode || 200;
    let emptyPayload = Boolean(def.emptyPayload);
    const customHeaders: Record<string, string> = {};

    // 1. Error probability calculation if in normal scenario but error rate is configured
    if (activeScenario === 'normal' && rule?.errorProbability && rule.errorProbability > 0) {
      const rand = Math.random();
      if (rand < rule.errorProbability) {
        statusCode = rule.errorStatusCode || 500;
      }
    }

    // Custom status code override
    if (rule?.customStatusCode) {
      statusCode = rule.customStatusCode;
    }

    // Specific header rules for scenarios
    if (statusCode === 429) {
      customHeaders['retry-after'] = '30';
    } else if (statusCode === 401) {
      customHeaders['www-authenticate'] = 'Bearer realm="TrafficGhost"';
    }

    // 2. Latency calculation
    let delayMs = 0;
    if (activeScenario === 'slow-network') {
      const min = def.latencyMin ?? 500;
      const max = def.latencyMax ?? 1500;
      delayMs = Math.floor(min + Math.random() * (max - min + 1));
    } else if (rule?.customLatencyMs !== undefined && rule.customLatencyMs > 0) {
      delayMs = rule.customLatencyMs;
    } else if (endpoint?.latencyMin !== undefined && endpoint?.latencyMax !== undefined) {
      delayMs = Math.floor(endpoint.latencyMin + Math.random() * (endpoint.latencyMax - endpoint.latencyMin + 1));
    } else if (globalLatency.enabled) {
      const min = Math.max(0, globalLatency.min);
      const max = Math.max(min, globalLatency.max);
      delayMs = Math.floor(min + Math.random() * (max - min + 1));
    } else if (def.latencyMin !== undefined && def.latencyMax !== undefined) {
      delayMs = Math.floor(def.latencyMin + Math.random() * (def.latencyMax - def.latencyMin + 1));
    }

    return {
      statusCode,
      delayMs,
      emptyPayload,
      scenarioApplied: activeScenario,
      customHeaders
    };
  }

  /**
   * Applies the calculated latency delay.
   */
  public static async applyLatency(delayMs: number): Promise<void> {
    if (delayMs <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * Returns a standard error body payload for error status codes.
   */
  public static createErrorResponse(statusCode: number, message?: string): Record<string, unknown> {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      408: 'Request Timeout',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };

    const statusText = errorNames[statusCode] || 'Error';
    return {
      error: {
        code: statusCode,
        status: statusText,
        message: message || `TrafficGhost simulated ${statusCode} ${statusText}`,
        timestamp: new Date().toISOString()
      }
    };
  }
}
