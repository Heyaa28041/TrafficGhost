import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { generateSessionId, GhostSession } from '../src/models/ghost-session';
import { WorkspaceManager } from '../src/storage/workspace-manager';

describe('GhostSession persistence tests', () => {
  it('should generate stable IDs', () => {
    const id = generateSessionId('Checkout Flow');
    assert.ok(id.startsWith('checkout-flow-'));
  });

  it('should save, load, and delete session files', () => {
    const manager = WorkspaceManager.getInstance();
    const mockSession: GhostSession = {
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
    } catch {
      // ignore
    }
  });
});
