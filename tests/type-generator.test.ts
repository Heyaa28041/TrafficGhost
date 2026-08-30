import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { TypeGenerator } from '../src/generator/type-generator';
import { RestEndpointDefinition } from '../src/models/endpoint';

describe('TypeGenerator tests', () => {
  it('should generate TypeScript interfaces from response body shape', () => {
    const mockEndpoint: RestEndpointDefinition = {
      id: 'get_users',
      method: 'GET',
      pathPattern: '/api/users',
      rawPaths: ['/api/users'],
      parameters: [],
      queryParameters: [],
      responses: [],
      defaultResponse: {
        id: 'default',
        statusCode: 200,
        headers: {},
        body: [
          { id: 1, name: 'Alice', active: true }
        ],
        isDefault: true
      },
      requestCount: 1,
      sampleRequests: []
    };

    const result = TypeGenerator.generateFromEndpoint(mockEndpoint);
    assert.ok(result);
    assert.ok(result.declarations.includes('export interface UsersResponse'));
    assert.ok(result.declarations.includes('export interface User'));
    assert.ok(result.declarations.includes('id: number;'));
    assert.ok(result.declarations.includes('name: string;'));
    assert.ok(result.declarations.includes('active: boolean;'));
  });
});
