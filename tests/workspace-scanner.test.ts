import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceScanner } from '../src/analyzer/workspace-scanner';

describe('WorkspaceScanner tests', () => {
  it('should scan files for API references', async () => {
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

    const result = await WorkspaceScanner.scanForEndpoint(
      'user_endpoint',
      'GET',
      '/api/users',
      root
    );

    assert.ok(result);
    assert.strictEqual(result.usages.length, 1);
    assert.strictEqual(path.basename(result.usages[0].filePath), 'testComponent.tsx');
    assert.strictEqual(result.usages[0].confidence, 'CONFIRMED');

    // Cleanup
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });
});
