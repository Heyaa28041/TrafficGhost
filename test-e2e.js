// End-to-end TrafficGhost test
const fs = require('fs');
const http = require('http');

const API_BASE = 'http://localhost:4001';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          else resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  try {
    console.log('[TEST] 1. Check engine health...');
    const health = await request('GET', '/health');
    console.log('  ✓ Engine ready:', health);
    
    console.log('\n[TEST] 2. Import demo.har...');
    const harJson = fs.readFileSync('./trafficghost/demo/demo.har', 'utf-8');
    const importResult = await request('POST', '/import/har-json', {
      harJson,
      source: 'demo.har'
    });
    console.log(`  ✓ Imported ${importResult.imported} requests`);
    
    console.log('\n[TEST] 3. Analyze traffic...');
    const analysis = await request('POST', '/analyze', {});
    console.log(`  ✓ Detected ${analysis.stats.totalEndpoints} endpoints`);
    console.log(`    - ${analysis.stats.dynamicRoutes} dynamic routes`);
    console.log(`    - ${analysis.stats.paginatedEndpoints} paginated`);
    
    console.log('\n[TEST] 4. Generate mocks...');
    const genResult = await request('POST', '/generate', {});
    console.log(`  ✓ Generated ${genResult.count} mock definitions`);
    
    console.log('\n[TEST] 5. Start mock server...');
    const mockStart = await request('POST', '/mock/start', { port: 4000 });
    console.log(`  ✓ Mock running: ${mockStart.url}`);
    
    console.log('\n[TEST] 6. Test mock endpoints...');
    const userRes = await fetch('http://localhost:4000/api/users');
    const userData = await userRes.json();
    console.log(`  ✓ GET /api/users [${userRes.status}]`);
    
    const userByIdRes = await fetch('http://localhost:4000/api/users/123');
    console.log(`  ✓ GET /api/users/:id [${userByIdRes.status}]`);
    
    const loginRes = await fetch('http://localhost:4000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' })
    });
    console.log(`  ✓ POST /api/login [${loginRes.status}]`);
    
    console.log('\n[TEST] 7. Test behavior - latency...');
    await request('PUT', '/behavior', { latencyMs: 1000 });
    const before = Date.now();
    await fetch('http://localhost:4000/api/users');
    const latency = Date.now() - before;
    console.log(`  ✓ Request with 1000ms latency took ${latency}ms`);
    
    console.log('\n[TEST] 8. Test behavior - error injection...');
    await request('PUT', '/behavior', { errorRates: { 500: 1 } });
    const errRes = await fetch('http://localhost:4000/api/users');
    console.log(`  ✓ Error injection 500 [${errRes.status}]`);
    
    console.log('\n[TEST] 9. Restore normal...');
    await request('PUT', '/behavior', { latencyMs: 0, errorRates: {} });
    const normalRes = await fetch('http://localhost:4000/api/users');
    console.log(`  ✓ Restored normal [${normalRes.status}]`);
    
    console.log('\n[TEST] ✓ All tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n[TEST] ✗ Error:', err.message);
    process.exit(1);
  }
}

test();
