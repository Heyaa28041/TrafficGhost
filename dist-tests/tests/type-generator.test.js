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
const type_generator_1 = require("../src/generator/type-generator");
(0, node_test_1.describe)('TypeGenerator tests', () => {
    (0, node_test_1.it)('should generate TypeScript interfaces from response body shape', () => {
        const mockEndpoint = {
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
        const result = type_generator_1.TypeGenerator.generateFromEndpoint(mockEndpoint);
        assert.ok(result);
        assert.ok(result.declarations.includes('export interface UsersResponse'));
        assert.ok(result.declarations.includes('export interface User'));
        assert.ok(result.declarations.includes('id: number;'));
        assert.ok(result.declarations.includes('name: string;'));
        assert.ok(result.declarations.includes('active: boolean;'));
    });
});
//# sourceMappingURL=type-generator.test.js.map