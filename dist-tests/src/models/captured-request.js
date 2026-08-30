"use strict";
/**
 * Normalized model for network requests captured via HAR or browser recorder.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactHeaders = redactHeaders;
exports.detectSensitiveData = detectSensitiveData;
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
function detectSensitiveData(req) {
    const sensitiveKeys = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey', 'password', 'token', 'secret'];
    // Check request headers
    for (const k of Object.entries(req.headers)) {
        if (sensitiveKeys.includes(k[0].toLowerCase()))
            return true;
        if (k[1] === '[REDACTED]')
            return true;
    }
    // Check response headers
    for (const k of Object.entries(req.response.headers)) {
        if (sensitiveKeys.includes(k[0].toLowerCase()))
            return true;
        if (k[1] === '[REDACTED]')
            return true;
    }
    // Check request body keys
    if (req.body && typeof req.body === 'object') {
        const keys = Object.keys(req.body);
        for (const k of keys) {
            if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk)))
                return true;
        }
    }
    // Check response body keys
    if (req.response.body && typeof req.response.body === 'object') {
        const keys = Object.keys(req.response.body);
        for (const k of keys) {
            if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk)))
                return true;
        }
    }
    return false;
}
//# sourceMappingURL=captured-request.js.map