"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const ghost_state_manager_1 = require("../src/server/ghost-state-manager");
(0, node_test_1.describe)('GhostStateManager tests', () => {
    (0, node_test_1.it)('should initialize and reset state', () => {
        const manager = ghost_state_manager_1.GhostStateManager.getInstance();
        manager.reset();
        assert.deepStrictEqual(manager.getSnapshot(), {});
    });
    (0, node_test_1.it)('should infer resource keys correctly', () => {
        const manager = ghost_state_manager_1.GhostStateManager.getInstance();
        assert.strictEqual(manager.inferResourceKey('/api/users'), 'users');
        assert.strictEqual(manager.inferResourceKey('/api/users/:id'), 'users');
        assert.strictEqual(manager.inferResourceKey('/api/v1/products'), 'products');
        assert.strictEqual(manager.inferResourceKey('/api/orders/:id/items'), 'items');
    });
    (0, node_test_1.it)('should perform CRUD transformations', () => {
        const manager = ghost_state_manager_1.GhostStateManager.getInstance();
        manager.reset();
        const created = manager.create('users', { name: 'John Doe', email: 'john@gmail.com' });
        assert.ok(created);
        assert.strictEqual(created.name, 'John Doe');
        assert.strictEqual(created.id, 1);
        const users = manager.getAll('users');
        assert.strictEqual(users.length, 1);
        assert.strictEqual(users[0].name, 'John Doe');
        const single = manager.getById('users', '1');
        assert.ok(single);
        assert.strictEqual(single.name, 'John Doe');
        const updated = manager.update('users', '1', { name: 'Johnny Doe' });
        assert.ok(updated);
        assert.strictEqual(updated.name, 'Johnny Doe');
        const singleUpdated = manager.getById('users', '1');
        assert.strictEqual(singleUpdated.name, 'Johnny Doe');
        const deleted = manager.delete('users', '1');
        assert.strictEqual(deleted, true);
        assert.strictEqual(manager.getAll('users').length, 0);
    });
    (0, node_test_1.it)('should seed from a schema default response', () => {
        const manager = ghost_state_manager_1.GhostStateManager.getInstance();
        manager.reset();
        const mockSchema = {
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
        assert.strictEqual(users[0].name, 'Alice');
    });
});
//# sourceMappingURL=ghost-state-manager.test.js.map