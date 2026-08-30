import assert from 'assert';
import { describe, it, before, after } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import { IntegrationAdvisor } from '../src/analyzer/integration-advisor';

describe('IntegrationAdvisor tests', () => {
  const root = path.join(__dirname, 'temp_advisor_test');

  before(() => {
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    const pagesDir = path.join(root, 'pages');
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }
    fs.writeFileSync(path.join(pagesDir, 'Users.tsx'), `import * as React from 'react';\n// Users List Component`);
    fs.writeFileSync(path.join(root, 'index.ts'), `// Root index file`);
  });

  after(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should suggest pages/Users.tsx for endpoint /api/users', () => {
    const suggestions = IntegrationAdvisor.suggestLocations('/api/users', root);
    assert.ok(suggestions.length > 0);
    assert.strictEqual(path.basename(suggestions[0].filePath), 'Users.tsx');
    assert.ok(suggestions[0].reason.includes('Filename match'));
  });
});
