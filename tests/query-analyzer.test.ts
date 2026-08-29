import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { QueryAnalyzer } from '../src/analyzer/query-analyzer';
import { CapturedRequest } from '../src/models/captured-request';

describe('Query Parameter & Pagination Analyzer', () => {
  it('should detect pagination parameters page and limit and discover array payload', () => {
    const mockRequests: CapturedRequest[] = [
      {
        id: 'r1',
        method: 'GET',
        url: 'https://api.example.com/api/products?page=1&limit=5',
        path: '/api/products',
        query: { page: '1', limit: '5' },
        headers: {},
        response: {
          status: 200,
          headers: {},
          body: {
            products: [
              { id: 101, title: 'Item 1' },
              { id: 102, title: 'Item 2' }
            ],
            total: 10
          }
        },
        timestamp: Date.now()
      },
      {
        id: 'r2',
        method: 'GET',
        url: 'https://api.example.com/api/products?page=2&limit=5',
        path: '/api/products',
        query: { page: '2', limit: '5' },
        headers: {},
        response: {
          status: 200,
          headers: {},
          body: {
            products: [
              { id: 103, title: 'Item 3' },
              { id: 104, title: 'Item 4' }
            ],
            total: 10
          }
        },
        timestamp: Date.now()
      }
    ];

    const { queryParams, pagination } = QueryAnalyzer.analyzeQueryParams(mockRequests);

    assert.strictEqual(queryParams.length, 2);
    assert.strictEqual(pagination?.enabled, true);
    assert.strictEqual(pagination?.pageParam, 'page');
    assert.strictEqual(pagination?.limitParam, 'limit');
    assert.strictEqual(pagination?.itemsPath, 'products');
    assert.strictEqual(pagination?.allCapturedItems?.length, 4);
  });
});
