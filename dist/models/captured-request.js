"use strict";
/**
 * Normalized model for network requests captured via HAR or browser recorder.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactHeaders = redactHeaders;
/**
 * Utility to redact sensitive headers
 */
function redactHeaders(headers, redactList = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey', 'proxy-authorization']) {
    const result = {};
    const lowerRedact = new Set(redactList.map((h) => h.toLowerCase()));
    for (const [key, value] of Object.entries(headers)) {
        if (lowerRedact.has(key.toLowerCase())) {
            result[key] = '[REDACTED]';
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
//# sourceMappingURL=captured-request.js.map