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
const ghost_session_1 = require("../src/models/ghost-session");
const workspace_manager_1 = require("../src/storage/workspace-manager");
(0, node_test_1.describe)('GhostSession persistence tests', () => {
    (0, node_test_1.it)('should generate stable IDs', () => {
        const id = (0, ghost_session_1.generateSessionId)('Checkout Flow');
        assert.ok(id.startsWith('checkout-flow-'));
    });
    (0, node_test_1.it)('should save, load, and delete session files', () => {
        const manager = workspace_manager_1.WorkspaceManager.getInstance();
        const mockSession = {
            id: 'test-session-123',
            name: 'Test Session',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            requests: [],
            schema: {
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                globalScenario: 'normal',
                restEndpoints: [],
                graphqlEndpoints: []
            },
            metadata: {
                requestCount: 0,
                restEndpointCount: 0,
                graphqlEndpointCount: 0
            }
        };
        // Save
        const root = path.join(process.cwd(), 'tests', 'scratch');
        if (!fs.existsSync(root)) {
            fs.mkdirSync(root, { recursive: true });
        }
        const filePath = manager.saveGhostSession(mockSession, root);
        assert.ok(fs.existsSync(filePath));
        // Load list
        const sessions = manager.loadGhostSessions(root);
        assert.ok(sessions.length >= 1);
        assert.strictEqual(sessions[0].id, 'test-session-123');
        // Load single
        const single = manager.loadGhostSession('test-session-123', root);
        assert.ok(single);
        assert.strictEqual(single.name, 'Test Session');
        // Rename
        const renameRes = manager.renameGhostSession('test-session-123', 'Renamed Session', root);
        assert.strictEqual(renameRes, true);
        const renamed = manager.loadGhostSession('test-session-123', root);
        assert.strictEqual(renamed?.name, 'Renamed Session');
        // Delete
        const deleteRes = manager.deleteGhostSession('test-session-123', root);
        assert.strictEqual(deleteRes, true);
        assert.strictEqual(manager.loadGhostSession('test-session-123', root), null);
        // Cleanup
        try {
            fs.rmSync(root, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    });
});
//# sourceMappingURL=ghost-session.test.js.map