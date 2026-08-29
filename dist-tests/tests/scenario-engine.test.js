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
const scenario_engine_1 = require("../src/server/scenario-engine");
(0, node_test_1.describe)('Scenario Engine Unit Tests', () => {
    (0, node_test_1.it)('should evaluate normal scenario correctly', () => {
        const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior('normal', { enabled: false, min: 0, max: 0 });
        assert.strictEqual(behavior.statusCode, 200);
        assert.strictEqual(behavior.scenarioApplied, 'normal');
    });
    (0, node_test_1.it)('should evaluate server-error scenario returning 500', () => {
        const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior('server-error', { enabled: false, min: 0, max: 0 });
        assert.strictEqual(behavior.statusCode, 500);
        assert.strictEqual(behavior.scenarioApplied, 'server-error');
    });
    (0, node_test_1.it)('should evaluate rate-limited scenario returning 429 and retry-after header', () => {
        const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior('rate-limited', { enabled: false, min: 0, max: 0 });
        assert.strictEqual(behavior.statusCode, 429);
        assert.strictEqual(behavior.customHeaders?.['retry-after'], '30');
    });
    (0, node_test_1.it)('should apply endpoint-specific scenario override over global scenario', () => {
        const mockEndpoint = {
            id: 'test_ep',
            method: 'GET',
            pathPattern: '/api/special',
            scenarioRule: {
                activeScenario: 'not-found'
            }
        };
        const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior('normal', { enabled: false, min: 0, max: 0 }, mockEndpoint);
        assert.strictEqual(behavior.statusCode, 404);
        assert.strictEqual(behavior.scenarioApplied, 'not-found');
    });
});
//# sourceMappingURL=scenario-engine.test.js.map