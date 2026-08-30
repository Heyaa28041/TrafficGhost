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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const resilience_analyzer_1 = require("../src/analyzer/resilience-analyzer");
(0, node_test_1.describe)('ResilienceAnalyzer tests', () => {
    const root = path.join(__dirname, 'temp_resilience_test');
    const testFile = path.join(root, 'UsersComponent.tsx');
    (0, node_test_1.before)(() => {
        if (!fs.existsSync(root)) {
            fs.mkdirSync(root, { recursive: true });
        }
        fs.writeFileSync(testFile, `import React, { useState } from 'react';
export function Users() {
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.status === 401) {
        // clear token
      }
      const data = await res.json();
    } catch (e) {
      setErr(e);
    }
  };
}`);
    });
    (0, node_test_1.after)(() => {
        try {
            fs.rmSync(root, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    });
    (0, node_test_1.it)('should analyze API code window and detect loading, error, and status handlings', () => {
        const mockMatch = {
            filePath: testFile,
            lineNumber: 8,
            lineContent: `const res = await fetch('/api/users');`,
            confidence: 'CONFIRMED',
            usageType: 'fetch'
        };
        const report = resilience_analyzer_1.ResilienceAnalyzer.analyzeUsages([mockMatch]);
        assert_1.default.strictEqual(report.usagesAnalyzed, 1);
        assert_1.default.strictEqual(report.loadingDetected, true);
        assert_1.default.strictEqual(report.errorDetected, true);
        const s401 = report.statusGaps.find(g => g.code === 401);
        assert_1.default.ok(s401);
        assert_1.default.strictEqual(s401.status, 'handled');
        const s500 = report.statusGaps.find(g => g.code === 500);
        assert_1.default.ok(s500);
        // general catch block makes it "potentially handled"
        assert_1.default.strictEqual(s500.status, 'potentially handled');
    });
});
//# sourceMappingURL=resilience-analyzer.test.js.map