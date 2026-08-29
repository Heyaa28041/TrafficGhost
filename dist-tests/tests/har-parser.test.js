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
const har_parser_1 = require("../src/parser/har-parser");
function getSampleHarPath() {
    const p1 = path.join(process.cwd(), 'demo', 'sample-traffic.har');
    if (fs.existsSync(p1))
        return p1;
    const p2 = path.join(__dirname, '..', 'demo', 'sample-traffic.har');
    if (fs.existsSync(p2))
        return p2;
    const p3 = path.join(__dirname, '..', '..', 'demo', 'sample-traffic.har');
    if (fs.existsSync(p3))
        return p3;
    return p1;
}
(0, node_test_1.describe)('HAR Parser & Traffic Normalizer', () => {
    (0, node_test_1.it)('should parse valid HAR file with 47 entries and normalize CapturedRequests', () => {
        const harPath = getSampleHarPath();
        assert.strictEqual(fs.existsSync(harPath), true, `Sample HAR file must exist at ${harPath}`);
        const raw = fs.readFileSync(harPath, 'utf-8');
        const requests = har_parser_1.HarParser.parse(raw);
        assert.strictEqual(requests.length, 47, 'Should parse all 47 requests from sample HAR');
        const first = requests[0];
        assert.strictEqual(first.method, 'GET');
        assert.strictEqual(first.path, '/api/users');
        assert.strictEqual(first.response.status, 200);
        assert.ok(first.response.body, 'Response body should be parsed');
    });
    (0, node_test_1.it)('should redact sensitive authorization and cookie headers', () => {
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
        const requests = har_parser_1.HarParser.parse(rawHar, ['authorization', 'cookie', 'set-cookie', 'x-api-key']);
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
//# sourceMappingURL=har-parser.test.js.map