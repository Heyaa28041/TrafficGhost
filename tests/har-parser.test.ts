import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { HarParser } from '../src/parser/har-parser';

function getSampleHarPath(): string {
  const p1 = path.join(process.cwd(), 'demo', 'sample-traffic.har');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(__dirname, '..', 'demo', 'sample-traffic.har');
  if (fs.existsSync(p2)) return p2;
  const p3 = path.join(__dirname, '..', '..', 'demo', 'sample-traffic.har');
  if (fs.existsSync(p3)) return p3;
  return p1;
}

describe('HAR Parser & Traffic Normalizer', () => {
  it('should parse valid HAR file with 52 entries and normalize CapturedRequests', () => {
    const harPath = getSampleHarPath();
    assert.strictEqual(fs.existsSync(harPath), true, `Sample HAR file must exist at ${harPath}`);

    const raw = fs.readFileSync(harPath, 'utf-8');
    const requests = HarParser.parse(raw);

    assert.strictEqual(requests.length, 52, 'Should parse all 52 requests from sample HAR');

    const first = requests[0];
    assert.strictEqual(first.method, 'GET');
    assert.strictEqual(first.path, '/api/users');
    assert.strictEqual(first.response.status, 200);
    assert.ok(first.response.body, 'Response body should be parsed');
  });

  it('should redact sensitive authorization and cookie headers', () => {
    const rawHar = JSON.stringify({
      log: {
        version: '1.2',
        entries: [
          {
            startedDateTime: '2026-08-29T10:00:00.000Z',
            time: 40,
            request: {
              method: 'GET',
              url: 'https://api.example.com/api/users',
              headers: [
                { name: 'Authorization', value: 'Bearer super_secret_jwt_token' },
                { name: 'Cookie', value: 'session_id=12345' },
                { name: 'X-API-Key', value: 'secret-key-1' },
                { name: 'Accept', value: 'application/json' }
              ]
            },
            response: {
              status: 200,
              headers: [
                { name: 'Set-Cookie', value: 'refresh_token=secret_refresh' },
                { name: 'Content-Type', value: 'application/json' }
              ],
              content: {
                size: 2,
                mimeType: 'application/json',
                text: '[]'
              }
            }
          }
        ]
      }
    });

    const requests = HarParser.parse(rawHar, ['authorization', 'cookie', 'set-cookie', 'x-api-key']);
    assert.strictEqual(requests.length, 1);

    const req = requests[0];
    assert.strictEqual(req.headers['authorization'], '[REDACTED]');
    assert.strictEqual(req.headers['cookie'], '[REDACTED]');
    assert.strictEqual(req.headers['x-api-key'], '[REDACTED]');
    assert.strictEqual(req.headers['accept'], 'application/json');
    assert.strictEqual(req.response.headers['set-cookie'], '[REDACTED]');
    assert.strictEqual(req.response.headers['content-type'], 'application/json');
  });
});
