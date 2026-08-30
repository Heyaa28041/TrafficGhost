import assert from 'assert';
import { describe, it, before, after } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import { ResilienceAnalyzer } from '../src/analyzer/resilience-analyzer';
import { ApiUsageMatch } from '../src/analyzer/workspace-scanner';

describe('ResilienceAnalyzer tests', () => {
  const root = path.join(__dirname, 'temp_resilience_test');
  const testFile = path.join(root, 'UsersComponent.tsx');

  before(() => {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    fs.writeFileSync(
      testFile,
      `import React, { useState } from 'react';
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
}`
    );
  });

  after(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should analyze API code window and detect loading, error, and status handlings', () => {
    const mockMatch: ApiUsageMatch = {
      filePath: testFile,
      lineNumber: 8,
      lineContent: `const res = await fetch('/api/users');`,
      confidence: 'CONFIRMED',
      usageType: 'fetch'
    };

    const report = ResilienceAnalyzer.analyzeUsages([mockMatch]);
    assert.strictEqual(report.usagesAnalyzed, 1);
    assert.strictEqual(report.loadingDetected, true);
    assert.strictEqual(report.errorDetected, true);
    
    const s401 = report.statusGaps.find(g => g.code === 401);
    assert.ok(s401);
    assert.strictEqual(s401.status, 'handled');

    const s500 = report.statusGaps.find(g => g.code === 500);
    assert.ok(s500);
    // general catch block makes it "potentially handled"
    assert.strictEqual(s500.status, 'potentially handled');
  });
});
