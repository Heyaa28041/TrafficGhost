import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { GhostStateManager } from '../src/server/ghost-state-manager';
import { TrafficGhostMockSchema } from '../src/models/endpoint';

describe('GhostStateManager tests', () => {
  it('should initialize and reset state', () => {
    const manager = GhostStateManager.getInstance();
    manager.reset();
    assert.deepStrictEqual(manager.getSnapshot(), {});
  });

  it('should infer resource keys correctly', () => {
    const manager = GhostStateManager.getInstance();
    assert.strictEqual(manager.inferResourceKey('/api/users'), 'users');
    assert.strictEqual(manager.inferResourceKey('/api/users/:id'), 'users');
    assert.strictEqual(manager.inferResourceKey('/api/v1/products'), 'products');
    assert.strictEqual(manager.inferResourceKey('/api/orders/:id/items'), 'items');
  });

  it('should perform CRUD transformations', () => {
    const manager = GhostStateManager.getInstance();
    manager.reset();

    const created = manager.create('users', { name: 'John Doe', email: 'john@gmail.com' });
    assert.ok(created);
    assert.strictEqual((created as any).name, 'John Doe');
    assert.strictEqual((created as any).id, 1);

    const users = manager.getAll('users');
    assert.strictEqual(users.length, 1);
    assert.strictEqual((users[0] as any).name, 'John Doe');

    const single = manager.getById('users', '1');
    assert.ok(single);
    assert.strictEqual((single as any).name, 'John Doe');

    const updated = manager.update('users', '1', { name: 'Johnny Doe' });
    assert.ok(updated);
    assert.strictEqual((updated as any).name, 'Johnny Doe');

    const singleUpdated = manager.getById('users', '1');
    assert.strictEqual((singleUpdated as any).name, 'Johnny Doe');

    const deleted = manager.delete('users', '1');
    assert.strictEqual(deleted, true);
    assert.strictEqual(manager.getAll('users').length, 0);
  });

  it('should seed from a schema default response', () => {
    const manager = GhostStateManager.getInstance();
    manager.reset();

    const mockSchema: TrafficGhostMockSchema = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      globalScenario: 'normal',
      graphqlEndpoints: [],
      restEndpoints: [
        {
          id: 'rest_users',
          method: 'GET',
          pathPattern: '/api/users',
          rawPaths: ['/api/users'],
          parameters: [],
          queryParameters: [],
          responses: [],
          defaultResponse: {
            id: 'default',
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: [
              { id: 10, name: 'Alice' },
              { id: 20, name: 'Bob' }
            ],
            isDefault: true
          },
          requestCount: 1,
          sampleRequests: []
        }
      ]
    };

    manager.seedFromSchema(mockSchema);
    assert.strictEqual(manager.hasState('users'), true);
    const users = manager.getAll('users');
    assert.strictEqual(users.length, 2);
    assert.strictEqual((users[0] as any).name, 'Alice');
  });
});
