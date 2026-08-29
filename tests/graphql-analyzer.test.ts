import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { GraphQLAnalyzer } from '../src/analyzer/graphql-analyzer';
import { CapturedRequest } from '../src/models/captured-request';

describe('GraphQL Analyzer', () => {
  it('should detect GraphQL requests and extract operation names and responses', () => {
    const mockGqlReq: CapturedRequest = {
      id: 'gql_1',
      method: 'POST',
      url: 'https://api.example.com/graphql',
      path: '/graphql',
      query: {},
      headers: { 'content-type': 'application/json' },
      body: {
        operationName: 'GetUsers',
        query: 'query GetUsers {\n  users {\n    id\n    name\n  }\n}',
        variables: {}
      },
      response: {
        status: 200,
        headers: {},
        body: {
          data: {
            users: [{ id: 1, name: 'Alice' }]
          }
        }
      },
      timestamp: Date.now()
    };

    assert.strictEqual(GraphQLAnalyzer.isGraphQLRequest(mockGqlReq), true);

    const endpoints = GraphQLAnalyzer.analyzeGraphQL([mockGqlReq]);
    assert.strictEqual(endpoints.length, 1);
    assert.strictEqual(endpoints[0].operationName, 'GetUsers');
    assert.strictEqual(endpoints[0].operationType, 'query');
    assert.ok(endpoints[0].defaultResponse.body);
  });
});
