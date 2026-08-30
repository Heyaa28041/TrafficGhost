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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const workspace_scanner_1 = require("../src/analyzer/workspace-scanner");
(0, node_test_1.describe)('WorkspaceScanner tests', () => {
    (0, node_test_1.it)('should scan files for API references', async () => {
        const root = path.join(process.cwd(), 'tests', 'scanner-scratch');
        if (!fs.existsSync(root)) {
            fs.mkdirSync(root, { recursive: true });
        }
        const testFile = path.join(root, 'testComponent.tsx');
        fs.writeFileSync(testFile, `
      import React from 'react';
      
      export function MyComponent() {
        const load = () => {
          fetch('/api/users');
        };
        return <div onClick={load}>Users List</div>;
      }
    `, 'utf-8');
        const result = await workspace_scanner_1.WorkspaceScanner.scanForEndpoint('user_endpoint', 'GET', '/api/users', root);
        assert.ok(result);
        assert.strictEqual(result.usages.length, 1);
        assert.strictEqual(path.basename(result.usages[0].filePath), 'testComponent.tsx');
        assert.strictEqual(result.usages[0].confidence, 'CONFIRMED');
        // Cleanup
        try {
            fs.rmSync(root, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    });
});
//# sourceMappingURL=workspace-scanner.test.js.map