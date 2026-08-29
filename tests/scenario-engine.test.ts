import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ScenarioEngine } from '../src/server/scenario-engine';
import { RestEndpointDefinition } from '../src/models/endpoint';

describe('Scenario Engine Unit Tests', () => {
  it('should evaluate normal scenario correctly', () => {
    const behavior = ScenarioEngine.evaluateBehavior('normal', { enabled: false, min: 0, max: 0 });
    assert.strictEqual(behavior.statusCode, 200);
    assert.strictEqual(behavior.scenarioApplied, 'normal');
  });

  it('should evaluate server-error scenario returning 500', () => {
    const behavior = ScenarioEngine.evaluateBehavior('server-error', { enabled: false, min: 0, max: 0 });
    assert.strictEqual(behavior.statusCode, 500);
    assert.strictEqual(behavior.scenarioApplied, 'server-error');
  });

  it('should evaluate rate-limited scenario returning 429 and retry-after header', () => {
    const behavior = ScenarioEngine.evaluateBehavior('rate-limited', { enabled: false, min: 0, max: 0 });
    assert.strictEqual(behavior.statusCode, 429);
    assert.strictEqual(behavior.customHeaders?.['retry-after'], '30');
  });

  it('should apply endpoint-specific scenario override over global scenario', () => {
    const mockEndpoint: Partial<RestEndpointDefinition> = {
      id: 'test_ep',
      method: 'GET',
      pathPattern: '/api/special',
      scenarioRule: {
        activeScenario: 'not-found'
      }
    };

    const behavior = ScenarioEngine.evaluateBehavior(
      'normal',
      { enabled: false, min: 0, max: 0 },
      mockEndpoint as RestEndpointDefinition
    );

    assert.strictEqual(behavior.statusCode, 404);
    assert.strictEqual(behavior.scenarioApplied, 'not-found');
  });
});
