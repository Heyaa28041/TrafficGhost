"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HarParser = void 0;
const captured_request_1 = require("../models/captured-request");
const output_channel_1 = require("../logging/output-channel");
class HarParser {
    /**
     * Parses raw HAR JSON string into an array of normalized CapturedRequests.
     */
    static parse(harJsonContent, redactHeaderNames) {
        let raw;
        try {
            raw = JSON.parse(harJsonContent);
        }
        catch (err) {
            throw new Error(`Failed to parse HAR JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (!raw.log || !Array.isArray(raw.log.entries)) {
            throw new Error('Invalid HAR file: missing log.entries array.');
        }
        const captured = [];
        let index = 0;
        for (const entry of raw.log.entries) {
            index++;
            if (!entry.request || !entry.request.url || !entry.request.method) {
                output_channel_1.logger.warn(`Skipping malformed HAR entry #${index}: missing request method or url.`);
                continue;
            }
            try {
                const normalized = HarParser.normalizeEntry(entry, index, redactHeaderNames);
                if (normalized) {
                    captured.push(normalized);
                }
            }
            catch (err) {
                output_channel_1.logger.warn(`Error normalizing HAR entry #${index}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        output_channel_1.logger.info(`Successfully parsed ${captured.length} requests from HAR.`);
        return captured;
    }
    /**
     * Normalizes a single HAR log entry into a CapturedRequest.
     */
    static normalizeEntry(entry, index, redactHeaderNames) {
        const req = entry.request;
        const res = entry.response || {};
        const timings = entry.timings || {};
        let parsedUrl;
        try {
            parsedUrl = new URL(req.url);
        }
        catch {
            // Fallback for relative or malformed URLs
            try {
                parsedUrl = new URL(req.url, 'http://localhost');
            }
            catch {
                return null;
            }
        }
        // Extract request headers
        const rawReqHeaders = {};
        if (Array.isArray(req.headers)) {
            for (const h of req.headers) {
                if (h && h.name) {
                    rawReqHeaders[h.name.toLowerCase()] = h.value || '';
                }
            }
        }
        const headers = (0, captured_request_1.redactHeaders)(rawReqHeaders, redactHeaderNames);
        // Extract query parameters
        const query = {};
        if (Array.isArray(req.queryString) && req.queryString.length > 0) {
            for (const q of req.queryString) {
                if (q && q.name) {
                    if (query[q.name] !== undefined) {
                        const existing = query[q.name];
                        if (Array.isArray(existing)) {
                            existing.push(q.value || '');
                        }
                        else {
                            query[q.name] = [existing, q.value || ''];
                        }
                    }
                    else {
                        query[q.name] = q.value || '';
                    }
                }
            }
        }
        else {
            // Fallback to URL search params
            parsedUrl.searchParams.forEach((val, key) => {
                if (query[key] !== undefined) {
                    const existing = query[key];
                    if (Array.isArray(existing)) {
                        existing.push(val);
                    }
                    else {
                        query[key] = [existing, val];
                    }
                }
                else {
                    query[key] = val;
                }
            });
        }
        // Extract request body
        let requestBody = undefined;
        let requestContentType = rawReqHeaders['content-type'] || req.postData?.mimeType;
        if (req.postData?.text) {
            const rawText = req.postData.text;
            if (requestContentType && requestContentType.includes('application/json')) {
                try {
                    requestBody = JSON.parse(rawText);
                }
                catch {
                    requestBody = rawText;
                }
            }
            else if (requestContentType &&
                requestContentType.includes('application/x-www-form-urlencoded') &&
                req.postData.params) {
                const formObj = {};
                for (const p of req.postData.params) {
                    if (p.name)
                        formObj[p.name] = p.value || '';
                }
                requestBody = formObj;
            }
            else {
                requestBody = rawText;
            }
        }
        // Extract response headers
        const rawResHeaders = {};
        if (Array.isArray(res.headers)) {
            for (const h of res.headers) {
                if (h && h.name) {
                    rawResHeaders[h.name.toLowerCase()] = h.value || '';
                }
            }
        }
        const responseHeaders = (0, captured_request_1.redactHeaders)(rawResHeaders, redactHeaderNames);
        // Extract response body
        let responseBody = undefined;
        const resContent = res.content || {};
        const resMime = (resContent.mimeType || rawResHeaders['content-type'] || '').toLowerCase();
        let resText = resContent.text || '';
        if (resContent.encoding === 'base64' && resText) {
            try {
                const decoded = Buffer.from(resText, 'base64').toString('utf-8');
                // Check if decoded string is valid text / json
                if (resMime.includes('json') || resMime.includes('text') || resMime.includes('javascript')) {
                    resText = decoded;
                }
            }
            catch {
                // keep as is
            }
        }
        if (resText) {
            if (resMime.includes('application/json') || resMime.includes('+json')) {
                try {
                    responseBody = JSON.parse(resText);
                }
                catch {
                    responseBody = resText;
                }
            }
            else {
                // Try parsing JSON anyway in case mime type is missing/generic
                try {
                    responseBody = JSON.parse(resText);
                }
                catch {
                    responseBody = resText;
                }
            }
        }
        else {
            responseBody = null;
        }
        const statusCode = typeof res.status === 'number' && res.status > 0 ? res.status : 200;
        // Timing extraction
        const duration = typeof entry.time === 'number' && entry.time >= 0 ? Math.round(entry.time) : 50;
        const startTimestamp = entry.startedDateTime ? new Date(entry.startedDateTime).getTime() : Date.now();
        const timing = {
            start: startTimestamp,
            duration: Math.max(duration, 1),
            dns: timings.dns && timings.dns > 0 ? timings.dns : undefined,
            connect: timings.connect && timings.connect > 0 ? timings.connect : undefined,
            send: timings.send && timings.send > 0 ? timings.send : undefined,
            wait: timings.wait && timings.wait > 0 ? timings.wait : undefined,
            receive: timings.receive && timings.receive > 0 ? timings.receive : undefined,
        };
        const capturedResponse = {
            status: statusCode,
            statusText: res.statusText || (statusCode === 200 ? 'OK' : ''),
            headers: responseHeaders,
            body: responseBody,
            contentType: resMime || 'application/json',
            contentLength: resContent.size || (typeof resText === 'string' ? resText.length : 0),
            isBase64: resContent.encoding === 'base64'
        };
        return {
            id: `req_${index}_${Math.random().toString(36).substring(2, 8)}`,
            method: req.method.toUpperCase(),
            url: req.url,
            protocol: parsedUrl.protocol.replace(':', ''),
            host: parsedUrl.host,
            path: parsedUrl.pathname,
            query,
            headers,
            body: requestBody,
            contentType: requestContentType,
            response: capturedResponse,
            timing,
            timestamp: startTimestamp
        };
    }
}
exports.HarParser = HarParser;
//# sourceMappingURL=har-parser.js.map