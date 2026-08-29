// TrafficGhost — HAR 1.2 Parser
// Converts HAR entries into TrafficRecord[] with no HAR-specific types leaking downstream.
import { randomUUID } from "crypto";
export function parseHar(rawJson) {
    let har;
    try {
        har = JSON.parse(rawJson);
    }
    catch {
        throw new Error("Invalid JSON: could not parse HAR file.");
    }
    if (!har?.log?.entries) {
        throw new Error("HAR contains no log.entries — is this a valid HAR 1.2 file?");
    }
    const entries = har.log.entries;
    if (entries.length === 0) {
        throw new Error("HAR contains no HTTP entries.");
    }
    const records = [];
    const errors = [];
    let skipped = 0;
    for (const entry of entries) {
        try {
            const record = entryToRecord(entry);
            if (record) {
                records.push(record);
            }
            else {
                skipped++;
            }
        }
        catch (e) {
            errors.push(`Skipped entry: ${e.message}`);
            skipped++;
        }
    }
    if (records.length === 0) {
        throw new Error("HAR contains no parseable HTTP entries.");
    }
    return { records, skipped, errors };
}
function entryToRecord(entry) {
    if (!entry.request?.url || !entry.request?.method) {
        return null; // skip malformed
    }
    const { method, url } = entry.request;
    // Skip non-HTTP resources (data URIs, ws://, etc.)
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return null;
    }
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    }
    catch {
        return null;
    }
    // Skip obvious static assets
    const staticExts = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|webp|avif|mp4|pdf)$/i;
    if (staticExts.test(parsedUrl.pathname)) {
        return null;
    }
    const requestHeaders = headersArrayToRecord(entry.request.headers ?? []);
    const query = queryStringToRecord(entry.request.queryString ?? []);
    const responseHeaders = headersArrayToRecord(entry.response.headers ?? []);
    // Parse request body
    let requestBody = undefined;
    if (entry.request.postData?.text) {
        requestBody = tryParseJson(entry.request.postData.text);
    }
    // Parse response body
    let responseBody = undefined;
    const content = entry.response.content;
    if (content?.text && content.text.length > 0) {
        if (content.encoding === "base64") {
            try {
                const decoded = Buffer.from(content.text, "base64").toString("utf-8");
                responseBody = tryParseJson(decoded);
            }
            catch {
                responseBody = content.text;
            }
        }
        else {
            responseBody = tryParseJson(content.text);
        }
    }
    const record = {
        id: randomUUID(),
        method: method.toUpperCase(),
        url,
        host: parsedUrl.hostname,
        path: parsedUrl.pathname,
        query,
        requestHeaders,
        requestBody,
        responseStatus: entry.response.status,
        responseHeaders,
        responseBody,
        responseMimeType: content?.mimeType,
        timing: {
            startedAt: entry.startedDateTime ? new Date(entry.startedDateTime).getTime() : undefined,
            durationMs: entry.time ?? undefined,
        },
        source: "har",
    };
    return record;
}
function headersArrayToRecord(headers) {
    const result = {};
    for (const h of headers) {
        // Lowercase header names for consistency
        result[h.name.toLowerCase()] = h.value;
    }
    return result;
}
function queryStringToRecord(qs) {
    const result = {};
    for (const q of qs) {
        result[q.name] = q.value;
    }
    return result;
}
function tryParseJson(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(trimmed);
        }
        catch {
            return text;
        }
    }
    return text;
}
//# sourceMappingURL=HarParser.js.map