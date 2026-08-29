import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { HarParser } from '../src/parser/har-parser';
import { TrafficAnalyzer } from '../src/analyzer/traffic-analyzer';
import { TrafficGhostMockServer } from '../src/server/mock-server';
import { TrafficGhostConfig, DEFAULT_CONFIG } from '../src/models/config';
import { TrafficGhostMockSchema } from '../src/models/endpoint';

function getSampleHarPath(): string {
  const p1 = path.join(process.cwd(), 'demo', 'sample-traffic.har');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(__dirname, '..', 'demo', 'sample-traffic.har');
  if (fs.existsSync(p2)) return p2;
  const p3 = path.join(__dirname, '..', '..', 'demo', 'sample-traffic.har');
  if (fs.existsSync(p3)) return p3;
  return p1;
}

function makeRequest(
  port: number,
  method: string,
  urlPath: string,
  body?: any
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const reqBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          ...(reqBody ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqBody) } : {})
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          const durationMs = Date.now() - start;
          let parsed: any = rawData;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            // keep raw
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsed,
            durationMs
          });
        });
      }
    );

    req.on('error', reject);
    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

describe('Mock Server End-to-End Dynamic Behavior', () => {
  const TEST_PORT = 4999;
  let server: TrafficGhostMockServer;
  let schema: TrafficGhostMockSchema;
  let config: TrafficGhostConfig;

  before(async () => {
    const harPath = getSampleHarPath();
    const rawHar = fs.readFileSync(harPath, 'utf-8');
    const requests = HarParser.parse(rawHar);

    schema = TrafficAnalyzer.analyze(requests);
    config = {
      ...DEFAULT_CONFIG,
      port: TEST_PORT,
      globalScenario: 'normal',
      latency: { enabled: false, min: 10, max: 20 }
    };

    server = new TrafficGhostMockServer(schema, config);
    await server.start();
  });

  after(async () => {
    if (server) {
      await server.stop();
    }
  });

  it('should return users list for GET /api/users', async () => {
    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body);
    assert.ok(res.body.users || Array.isArray(res.body));
  });

  it('should handle dynamic path parameter GET /api/users/999 and interpolate ID', async () => {
    const res = await makeRequest(TEST_PORT, 'GET', '/api/users/999');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body);
    assert.strictEqual(res.body.id, 999, 'Mock server must interpolate requested dynamic ID parameter');
  });

  it('should handle dynamic pagination for GET /api/products?page=2&limit=5', async () => {
    const res = await makeRequest(TEST_PORT, 'GET', '/api/products?page=2&limit=5');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body);
    const products = res.body.products || res.body;
    assert.ok(Array.isArray(products), 'Products should be an array');
    assert.strictEqual(res.body.page, 2);
    assert.strictEqual(res.body.limit, 5);
  });

  it('should handle GraphQL operation GetUsers via POST /graphql', async () => {
    const res = await makeRequest(TEST_PORT, 'POST', '/graphql', {
      operationName: 'GetUsers',
      query: 'query GetUsers { users { id name } }'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data);
    assert.ok(res.body.data.users);
  });

  it('should simulate Slow Network scenario with latency >= 500ms', async () => {
    config.globalScenario = 'slow-network';
    server.updateConfig(config);

    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 200);
    assert.ok(res.durationMs >= 480, `Expected latency delay >= 500ms, got ${res.durationMs}ms`);
  });

  it('should simulate Server Error scenario returning 500', async () => {
    config.globalScenario = 'server-error';
    server.updateConfig(config);

    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 500);
    assert.ok(res.body.error);
    assert.strictEqual(res.body.error.code, 500);
  });

  it('should simulate Rate Limited scenario returning 429 with retry-after header', async () => {
    config.globalScenario = 'rate-limited';
    server.updateConfig(config);

    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 429);
    assert.ok(res.headers['retry-after']);
  });

  it('should simulate Not Found scenario returning 404', async () => {
    config.globalScenario = 'not-found';
    server.updateConfig(config);

    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 404);
  });

  it('should simulate Unauthorized scenario returning 401', async () => {
    config.globalScenario = 'unauthorized';
    server.updateConfig(config);

    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 401);
  });

  it('should simulate Empty Response scenario returning 200 with empty collection', async () => {
    config.globalScenario = 'empty-response';
    server.updateConfig(config);

    const res = await makeRequest(TEST_PORT, 'GET', '/api/users');
    assert.strictEqual(res.status, 200);
    const users = res.body.users || res.body;
    assert.ok(Array.isArray(users));
    assert.strictEqual(users.length, 0);
  });
});
