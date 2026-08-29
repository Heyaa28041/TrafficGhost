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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const har_parser_1 = require("../src/parser/har-parser");
const traffic_analyzer_1 = require("../src/analyzer/traffic-analyzer");
const mock_server_1 = require("../src/server/mock-server");
const config_1 = require("../src/models/config");
function getSampleHarPath() {
    const p1 = path.join(process.cwd(), 'demo', 'sample-traffic.har');
    if (fs.existsSync(p1))
        return p1;
    const p2 = path.join(__dirname, '..', 'demo', 'sample-traffic.har');
    if (fs.existsSync(p2))
        return p2;
    const p3 = path.join(__dirname, '..', '..', 'demo', 'sample-traffic.har');
    if (fs.existsSync(p3))
        return p3;
    return p1;
}
function makeRequest(port, method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const reqBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
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
                const durationMs = Date.now() - start;
                let parsed = rawData;
                try {
                    parsed = JSON.parse(rawData);
                }
                catch {
                    // keep raw
                }
                resolve({
                    status: res.statusCode || 0,
                    headers: res.headers,
                    body: parsed,
                    durationMs
                });
            });
        });
        req.on('error', reject);
        if (reqBody) {
            req.write(reqBody);
        }
        req.end();
    });
}
(0, node_test_1.describe)('Mock Server End-to-End Dynamic Behavior', () => {
    const TEST_PORT = 4999;
    let server;
    let schema;
    let config;
    (0, node_test_1.before)(async () => {
        const harPath = getSampleHarPath();
        const rawHar = fs.readFileSync(harPath, 'utf-8');
        const requests = har_parser_1.HarParser.parse(rawHar);
        schema = traffic_analyzer_1.TrafficAnalyzer.analyze(requests);
        config = {
            ...config_1.DEFAULT_CONFIG,
            port: TEST_PORT,
            globalScenario: 'normal',
            latency: { enabled: false, min: 10, max: 20 }
        };
        server = new mock_server_1.TrafficGhostMockServer(schema, config);
        await server.start();
    });
    (0, node_test_1.after)(async () => {
        if (server) {
            await server.stop();
        }
    });
    (0, node_test_1.it)('should return users list for GET /api/users', async () => {
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body);
        assert.ok(res.body.users || Array.isArray(res.body));
    });
    (0, node_test_1.it)('should handle dynamic path parameter GET /api/users/999 and interpolate ID', async () => {
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users/999');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body);
        assert.strictEqual(res.body.id, 999, 'Mock server must interpolate requested dynamic ID parameter');
    });
    (0, node_test_1.it)('should handle dynamic pagination for GET /api/products?page=2&limit=5', async () => {
        const res = await makeRequest(TEST_PORT, 'GET', '/api/products?page=2&limit=5');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body);
        const products = res.body.products || res.body;
        assert.ok(Array.isArray(products), 'Products should be an array');
        assert.strictEqual(res.body.page, 2);
        assert.strictEqual(res.body.limit, 5);
    });
    (0, node_test_1.it)('should handle GraphQL operation GetUsers via POST /graphql', async () => {
        const res = await makeRequest(TEST_PORT, 'POST', '/graphql', {
            operationName: 'GetUsers',
            query: 'query GetUsers { users { id name } }'
        });
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.data);
        assert.ok(res.body.data.users);
    });
    (0, node_test_1.it)('should simulate Slow Network scenario with latency >= 500ms', async () => {
        config.globalScenario = 'slow-network';
        server.updateConfig(config);
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 200);
        assert.ok(res.durationMs >= 480, `Expected latency delay >= 500ms, got ${res.durationMs}ms`);
    });
    (0, node_test_1.it)('should simulate Server Error scenario returning 500', async () => {
        config.globalScenario = 'server-error';
        server.updateConfig(config);
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 500);
        assert.ok(res.body.error);
        assert.strictEqual(res.body.error.code, 500);
    });
    (0, node_test_1.it)('should simulate Rate Limited scenario returning 429 with retry-after header', async () => {
        config.globalScenario = 'rate-limited';
        server.updateConfig(config);
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 429);
        assert.ok(res.headers['retry-after']);
    });
    (0, node_test_1.it)('should simulate Not Found scenario returning 404', async () => {
        config.globalScenario = 'not-found';
        server.updateConfig(config);
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 404);
    });
    (0, node_test_1.it)('should simulate Unauthorized scenario returning 401', async () => {
        config.globalScenario = 'unauthorized';
        server.updateConfig(config);
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 401);
    });
    (0, node_test_1.it)('should simulate Empty Response scenario returning 200 with empty collection', async () => {
        config.globalScenario = 'empty-response';
        server.updateConfig(config);
        const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
        assert.strictEqual(res.status, 200);
        const users = res.body.users || res.body;
        assert.ok(Array.isArray(users));
        assert.strictEqual(users.length, 0);
    });
});
//# sourceMappingURL=mock-server.test.js.map