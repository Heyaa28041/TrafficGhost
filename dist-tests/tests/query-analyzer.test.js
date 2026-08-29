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
const query_analyzer_1 = require("../src/analyzer/query-analyzer");
(0, node_test_1.describe)('Query Parameter & Pagination Analyzer', () => {
    (0, node_test_1.it)('should detect pagination parameters page and limit and discover array payload', () => {
        const mockRequests = [
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
        const { queryParams, pagination } = query_analyzer_1.QueryAnalyzer.analyzeQueryParams(mockRequests);
        assert.strictEqual(queryParams.length, 2);
        assert.strictEqual(pagination?.enabled, true);
        assert.strictEqual(pagination?.pageParam, 'page');
        assert.strictEqual(pagination?.limitParam, 'limit');
        assert.strictEqual(pagination?.itemsPath, 'products');
        assert.strictEqual(pagination?.allCapturedItems?.length, 4);
    });
});
//# sourceMappingURL=query-analyzer.test.js.map