import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { RouteInferrer } from '../src/analyzer/route-inferrer';

describe('Route Inferrer', () => {
  it('should infer /api/users/:id from multiple user ID paths', () => {
    const rawPaths = [
      '/api/users/1',
      '/api/users/2',
      '/api/users/3'
    ];

    const results = RouteInferrer.inferRoutes(rawPaths);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].pattern, '/api/users/:id');
    assert.strictEqual(results[0].parameters.length, 1);
    assert.strictEqual(results[0].parameters[0].name, 'id');
    assert.strictEqual(results[0].parameters[0].inferredType, 'number');
  });

  it('should infer /api/products/:id from products paths', () => {
    const rawPaths = [
      '/api/products/123',
      '/api/products/456'
    ];

    const results = RouteInferrer.inferRoutes(rawPaths);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].pattern, '/api/products/:id');
    assert.strictEqual(results[0].parameters.length, 1);
  });

  it('should handle single numeric ID path as dynamic parameter', () => {
    const rawPaths = ['/api/orders/999'];
    const results = RouteInferrer.inferRoutes(rawPaths);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].pattern, '/api/orders/:id');
  });

  it('should preserve static exceptions like /api/health and /api/metrics/summary', () => {
    const rawPaths = [
      '/api/health',
      '/api/metrics/summary'
    ];

    const results = RouteInferrer.inferRoutes(rawPaths);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results.find((r) => r.pattern === '/api/health')?.parameters.length, 0);
    assert.strictEqual(results.find((r) => r.pattern === '/api/metrics/summary')?.parameters.length, 0);
  });
});
