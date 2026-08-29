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
const graphql_analyzer_1 = require("../src/analyzer/graphql-analyzer");
(0, node_test_1.describe)('GraphQL Analyzer', () => {
    (0, node_test_1.it)('should detect GraphQL requests and extract operation names and responses', () => {
        const mockGqlReq = {
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
        assert.strictEqual(graphql_analyzer_1.GraphQLAnalyzer.isGraphQLRequest(mockGqlReq), true);
        const endpoints = graphql_analyzer_1.GraphQLAnalyzer.analyzeGraphQL([mockGqlReq]);
        assert.strictEqual(endpoints.length, 1);
        assert.strictEqual(endpoints[0].operationName, 'GetUsers');
        assert.strictEqual(endpoints[0].operationType, 'query');
        assert.ok(endpoints[0].defaultResponse.body);
    });
});
//# sourceMappingURL=graphql-analyzer.test.js.map