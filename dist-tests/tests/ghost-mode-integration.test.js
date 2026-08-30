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
const http = __importStar(require("http"));
const mock_server_1 = require("../src/server/mock-server");
const ghost_state_manager_1 = require("../src/server/ghost-state-manager");
const config_1 = require("../src/models/config");
function makeRequest(port, method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const reqBody = body ? JSON.stringify(body) : undefined;
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: urlPath,
            method,
            headers: {
                ...(reqBody ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody) } : {})
            }
        }, (res) => {
            let rawData = '';
            res.on('data', (chunk) => (rawData += chunk));
            res.on('end', () => {
                let parsed = rawData;
                try {
                    parsed = JSON.parse(rawData);
                }
                catch {
                    // keep raw
                }
                resolve({
                    status: res.statusCode || 0,
                    body: parsed
                });
            });
        });
        req.on('error', reject);
        if (reqBody)
            req.write(reqBody);
        req.end();
    });
}
(0, node_test_1.describe)('Ghost Mode Integration tests', () => {
    let server;
    const port = 4055;
    const mockSchema = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        globalScenario: 'normal',
        graphqlEndpoints: [],
        restEndpoints: [
            {
                id: 'rest_get_users',
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
                        { id: 1, name: 'Alice' }
                    ],
                    isDefault: true
                },
                requestCount: 1,
                sampleRequests: []
            },
            {
                id: 'rest_get_user',
                method: 'GET',
                pathPattern: '/api/users/:id',
                rawPaths: ['/api/users/1'],
                parameters: [
                    { name: 'id', position: 2, inferredType: 'number', sampleValues: ['1'] }
                ],
                queryParameters: [],
                responses: [],
                defaultResponse: {
                    id: 'default',
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { id: 1, name: 'Alice' },
                    isDefault: true
                },
                requestCount: 1,
                sampleRequests: []
            },
            {
                id: 'rest_post_users',
                method: 'POST',
                pathPattern: '/api/users',
                rawPaths: ['/api/users'],
                parameters: [],
                queryParameters: [],
                responses: [],
                defaultResponse: {
                    id: 'default',
                    statusCode: 201,
                    headers: { 'content-type': 'application/json' },
                    body: { id: 2, name: 'Bob' },
                    isDefault: true
                },
                requestCount: 1,
                sampleRequests: []
            },
            {
                id: 'rest_delete_user',
                method: 'DELETE',
                pathPattern: '/api/users/:id',
                rawPaths: ['/api/users/1'],
                parameters: [
                    { name: 'id', position: 2, inferredType: 'number', sampleValues: ['1'] }
                ],
                queryParameters: [],
                responses: [],
                defaultResponse: {
                    id: 'default',
                    statusCode: 204,
                    headers: {},
                    body: null,
                    isDefault: true
                },
                requestCount: 1,
                sampleRequests: []
            }
        ]
    };
    (0, node_test_1.before)(async () => {
        // Reset Ghost State manager
        ghost_state_manager_1.GhostStateManager.getInstance().reset();
        server = new mock_server_1.TrafficGhostMockServer(mockSchema, {
            ...config_1.DEFAULT_CONFIG,
            port
        });
        server.setGhostMode(true, ghost_state_manager_1.GhostStateManager.getInstance());
        await server.start();
    });
    (0, node_test_1.after)(async () => {
        await server.stop();
    });
    (0, node_test_1.it)('should list seeded items', async () => {
        const res = await makeRequest(port, 'GET', '/api/users');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(Array.isArray(res.body), true);
        assert.strictEqual(res.body.length, 1);
        assert.strictEqual(res.body[0].name, 'Alice');
    });
    (0, node_test_1.it)('should create a new item via POST and persist state', async () => {
        const resPost = await makeRequest(port, 'POST', '/api/users', { name: 'Bob', email: 'bob@gmail.com' });
        assert.strictEqual(resPost.status, 201);
        assert.strictEqual(resPost.body.name, 'Bob');
        assert.strictEqual(resPost.body.id, 2);
        const resList = await makeRequest(port, 'GET', '/api/users');
        assert.strictEqual(resList.status, 200);
        assert.strictEqual(resList.body.length, 2);
        assert.strictEqual(resList.body[1].name, 'Bob');
    });
    (0, node_test_1.it)('should return 404 for missing single items', async () => {
        const res = await makeRequest(port, 'GET', '/api/users/999');
        assert.strictEqual(res.status, 404);
    });
    (0, node_test_1.it)('should remove item via DELETE', async () => {
        const resDelete = await makeRequest(port, 'DELETE', '/api/users/1');
        assert.strictEqual(resDelete.status, 204);
        const resList = await makeRequest(port, 'GET', '/api/users');
        assert.strictEqual(resList.status, 200);
        assert.strictEqual(resList.body.length, 1);
        assert.strictEqual(resList.body[0].name, 'Bob');
    });
});
//# sourceMappingURL=ghost-mode-integration.test.js.map