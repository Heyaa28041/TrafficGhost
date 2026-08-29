/**
 * Scenario configurations for TrafficGhost mock engine.
 */

export type ScenarioType =
  | 'normal'
  | 'slow-network'
  | 'rate-limited'
  | 'server-error'
  | 'not-found'
  | 'unauthorized'
  | 'empty-response';

export interface ScenarioDefinition {
  id: ScenarioType;
  name: string;
  description: string;
  statusCode?: number;
  latencyMin?: number;
  latencyMax?: number;
  emptyPayload?: boolean;
}

export const BUILTIN_SCENARIOS: Record<ScenarioType, ScenarioDefinition> = {
  'normal': {
    id: 'normal',
    name: 'Normal',
    description: 'Realistic standard 200/201 responses with natural or minimal latency.',
    statusCode: 200,
    latencyMin: 20,
    latencyMax: 80
  },
  'slow-network': {
    id: 'slow-network',
    name: 'Slow Network',
    description: 'Simulates high network latency (500ms - 1500ms) to test loading states & spinners.',
    latencyMin: 500,
    latencyMax: 1500
  },
  'rate-limited': {
    id: 'rate-limited',
    name: 'Rate Limited (429)',
    description: 'Simulates rate limiting with 429 Too Many Requests response and Retry-After header.',
    statusCode: 429
  },
  'server-error': {
    id: 'server-error',
    name: 'Server Error (500)',
    description: 'Simulates unexpected backend failure with 500 Internal Server Error.',
    statusCode: 500
  },
  'not-found': {
    id: 'not-found',
    name: 'Not Found (404)',
    description: 'Simulates missing resources with 404 Not Found response.',
    statusCode: 404
  },
  'unauthorized': {
    id: 'unauthorized',
    name: 'Unauthorized (401)',
    description: 'Simulates missing or expired credentials with 401 Unauthorized.',
    statusCode: 401
  },
  'empty-response': {
    id: 'empty-response',
    name: 'Empty Response',
    description: 'Returns status 200 with empty list or object to test empty states in UI.',
    statusCode: 200,
    emptyPayload: true
  }
};

export interface ScenarioRule {
  activeScenario: ScenarioType;
  customStatusCode?: number;
  customLatencyMs?: number;
  errorProbability?: number; // 0.0 to 1.0 (e.g. 0.05 for 5% error)
  errorStatusCode?: number;
}
