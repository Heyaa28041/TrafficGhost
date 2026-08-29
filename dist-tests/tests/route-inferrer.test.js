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
const route_inferrer_1 = require("../src/analyzer/route-inferrer");
(0, node_test_1.describe)('Route Inferrer', () => {
    (0, node_test_1.it)('should infer /api/users/:id from multiple user ID paths', () => {
        const rawPaths = [
            '/api/users/1',
            '/api/users/2',
            '/api/users/3'
        ];
        const results = route_inferrer_1.RouteInferrer.inferRoutes(rawPaths);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].pattern, '/api/users/:id');
        assert.strictEqual(results[0].parameters.length, 1);
        assert.strictEqual(results[0].parameters[0].name, 'id');
        assert.strictEqual(results[0].parameters[0].inferredType, 'number');
    });
    (0, node_test_1.it)('should infer /api/products/:id from products paths', () => {
        const rawPaths = [
            '/api/products/123',
            '/api/products/456'
        ];
        const results = route_inferrer_1.RouteInferrer.inferRoutes(rawPaths);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].pattern, '/api/products/:id');
        assert.strictEqual(results[0].parameters.length, 1);
    });
    (0, node_test_1.it)('should handle single numeric ID path as dynamic parameter', () => {
        const rawPaths = ['/api/orders/999'];
        const results = route_inferrer_1.RouteInferrer.inferRoutes(rawPaths);
        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].pattern, '/api/orders/:id');
    });
    (0, node_test_1.it)('should preserve static exceptions like /api/health and /api/metrics/summary', () => {
        const rawPaths = [
            '/api/health',
            '/api/metrics/summary'
        ];
        const results = route_inferrer_1.RouteInferrer.inferRoutes(rawPaths);
        assert.strictEqual(results.length, 2);
        assert.strictEqual(results.find((r) => r.pattern === '/api/health')?.parameters.length, 0);
        assert.strictEqual(results.find((r) => r.pattern === '/api/metrics/summary')?.parameters.length, 0);
    });
});
//# sourceMappingURL=route-inferrer.test.js.map