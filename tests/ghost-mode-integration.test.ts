import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'http';
import { TrafficGhostMockServer } from '../src/server/mock-server';
import { GhostStateManager } from '../src/server/ghost-state-manager';
import { TrafficGhostMockSchema } from '../src/models/endpoint';
import { DEFAULT_CONFIG } from '../src/models/config';

function makeRequest(
  port: number,
  method: string,
  urlPath: string,
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const reqBody = body ? JSON.stringify(body) : undefined;
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
          let parsed: any = rawData;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            // keep raw
          }
          resolve({
            status: res.statusCode || 0,
            body: parsed
          });
        });
      }
    );
    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

describe('Ghost Mode Integration tests', () => {
  let server: TrafficGhostMockServer;
  const port = 4055;

  const mockSchema: TrafficGhostMockSchema = {
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

  before(async () => {
    // Reset Ghost State manager
    GhostStateManager.getInstance().reset();
    
    server = new TrafficGhostMockServer(mockSchema, {
      ...DEFAULT_CONFIG,
      port
    });
    server.setGhostMode(true, GhostStateManager.getInstance());
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  it('should list seeded items', async () => {
    const res = await makeRequest(port, 'GET', '/api/users');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.body), true);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].name, 'Alice');
  });

  it('should create a new item via POST and persist state', async () => {
    const resPost = await makeRequest(port, 'POST', '/api/users', { name: 'Bob', email: 'bob@gmail.com' });
    assert.strictEqual(resPost.status, 201);
    assert.strictEqual(resPost.body.name, 'Bob');
    assert.strictEqual(resPost.body.id, 2);

    const resList = await makeRequest(port, 'GET', '/api/users');
    assert.strictEqual(resList.status, 200);
    assert.strictEqual(resList.body.length, 2);
    assert.strictEqual(resList.body[1].name, 'Bob');
  });

  it('should return 404 for missing single items', async () => {
    const res = await makeRequest(port, 'GET', '/api/users/999');
    assert.strictEqual(res.status, 404);
  });

  it('should remove item via DELETE', async () => {
    const resDelete = await makeRequest(port, 'DELETE', '/api/users/1');
    assert.strictEqual(resDelete.status, 204);

    const resList = await makeRequest(port, 'GET', '/api/users');
    assert.strictEqual(resList.status, 200);
    assert.strictEqual(resList.body.length, 1);
    assert.strictEqual(resList.body[0].name, 'Bob');
  });
});
