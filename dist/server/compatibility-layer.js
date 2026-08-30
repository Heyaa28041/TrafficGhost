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
exports.CompatibilityLayer = void 0;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
const output_channel_1 = require("../logging/output-channel");
class CompatibilityLayer {
    /**
     * Performs smart, tolerant route matching against registered REST endpoints.
     */
    static matchRestRoute(method, pathname, endpoints) {
        const normMethod = method.toUpperCase();
        const reqSegments = pathname.split('/').filter(Boolean);
        // 1. First attempt exact pathPattern match
        for (const ep of endpoints) {
            if (ep.method !== normMethod)
                continue;
            const epSegments = ep.pathPattern.split('/').filter(Boolean);
            if (epSegments.length !== reqSegments.length)
                continue;
            let match = true;
            const pathParams = {};
            for (let i = 0; i < epSegments.length; i++) {
                const epSeg = epSegments[i];
                const reqSeg = reqSegments[i];
                if (epSeg.startsWith(':')) {
                    const paramName = epSeg.slice(1);
                    pathParams[paramName] = reqSeg;
                }
                else if (epSeg.toLowerCase() !== reqSeg.toLowerCase()) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return {
                    endpoint: ep,
                    pathParams,
                    isExactMatch: true
                };
            }
        }
        // 2. Fuzzy / Tolerant Prefix Matching for sub-paths if applicable
        for (const ep of endpoints) {
            if (ep.method !== normMethod)
                continue;
            const epSegments = ep.pathPattern.split('/').filter(Boolean);
            // If requested path starts with endpoint path and has minor trailing variations
            if (epSegments.length > 0 && reqSegments.length === epSegments.length + 1) {
                let prefixMatch = true;
                const pathParams = {};
                for (let i = 0; i < epSegments.length; i++) {
                    const epSeg = epSegments[i];
                    const reqSeg = reqSegments[i];
                    if (epSeg.startsWith(':')) {
                        pathParams[epSeg.slice(1)] = reqSeg;
                    }
                    else if (epSeg.toLowerCase() !== reqSeg.toLowerCase()) {
                        prefixMatch = false;
                        break;
                    }
                }
                if (prefixMatch) {
                    pathParams['subResource'] = reqSegments[reqSegments.length - 1];
                    return {
                        endpoint: ep,
                        pathParams,
                        isExactMatch: false
                    };
                }
            }
        }
        return {
            endpoint: undefined,
            pathParams: {},
            isExactMatch: false
        };
    }
    /**
     * Generates a safe fallback response for unknown / newly added frontend endpoints.
     */
    static generateFallbackResponse(method, pathname, query, body, config) {
        const strategy = config.unknownEndpoint?.strategy || 'generate';
        switch (strategy) {
            case '404':
                return {
                    status: 404,
                    headers: { 'content-type': 'application/json' },
                    body: {
                        error: {
                            code: 404,
                            status: 'Not Found',
                            message: `[TrafficGhost] Unmocked endpoint: ${method} ${pathname}. Use TrafficGhost UI to add this mock.`,
                            path: pathname,
                            method
                        }
                    }
                };
            case 'empty':
                const isCollection = pathname.endsWith('s') || pathname.includes('/list') || pathname.includes('/search');
                return {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: isCollection ? [] : {}
                };
            case 'generate':
            default:
                return CompatibilityLayer.synthesizeMockResponse(method, pathname, query, body);
        }
    }
    /**
     * Synthesizes an intelligent, realistic mock response based on resource name and HTTP method.
     */
    static synthesizeMockResponse(method, pathname, query, body) {
        const segments = pathname.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] || 'item';
        const isId = /^\d+$/.test(lastSegment) || /^[0-9a-fA-F-]{12,}$/.test(lastSegment);
        const resourceName = isId && segments.length > 1 ? segments[segments.length - 2] : lastSegment;
        const singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
        const normMethod = method.toUpperCase();
        if (normMethod === 'GET') {
            if (isId) {
                // Single entity GET
                const numericId = /^\d+$/.test(lastSegment) ? parseInt(lastSegment, 10) : lastSegment;
                return {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: {
                        id: numericId,
                        [`${singularName}Name`]: `Generated ${singularName.charAt(0).toUpperCase() + singularName.slice(1)} ${numericId}`,
                        title: `Sample ${singularName.charAt(0).toUpperCase() + singularName.slice(1)} #${numericId}`,
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                };
            }
            else {
                // Collection GET
                const page = parseInt(query['page'] || query['p'] || '1', 10) || 1;
                const limit = parseInt(query['limit'] || query['pageSize'] || '5', 10) || 5;
                const items = [];
                for (let i = 1; i <= limit; i++) {
                    const itemId = (page - 1) * limit + i;
                    items.push({
                        id: itemId,
                        name: `${singularName.charAt(0).toUpperCase() + singularName.slice(1)} ${itemId}`,
                        title: `Sample ${singularName.charAt(0).toUpperCase() + singularName.slice(1)} ${itemId}`,
                        description: `Auto-generated mock description for item ${itemId}`,
                        status: 'active',
                        createdAt: new Date(Date.now() - itemId * 86400000).toISOString()
                    });
                }
                return {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: {
                        [resourceName]: items,
                        page,
                        limit,
                        total: 25,
                        totalPages: 5
                    }
                };
            }
        }
        else if (normMethod === 'POST') {
            const parsedBody = typeof body === 'object' && body !== null ? body : {};
            return {
                status: 201,
                headers: { 'content-type': 'application/json' },
                body: {
                    id: Math.floor(100 + Math.random() * 900),
                    ...parsedBody,
                    createdAt: new Date().toISOString(),
                    message: `${singularName.charAt(0).toUpperCase() + singularName.slice(1)} created successfully`
                }
            };
        }
        else if (normMethod === 'PUT' || normMethod === 'PATCH') {
            const parsedBody = typeof body === 'object' && body !== null ? body : {};
            return {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: {
                    id: isId ? (/^\d+$/.test(lastSegment) ? parseInt(lastSegment, 10) : lastSegment) : 1,
                    ...parsedBody,
                    updatedAt: new Date().toISOString(),
                    message: `${singularName.charAt(0).toUpperCase() + singularName.slice(1)} updated successfully`
                }
            };
        }
        else if (normMethod === 'DELETE') {
            return {
                status: 200,
                headers: { 'content-type': 'application/json' },
                body: {
                    success: true,
                    id: isId ? (/^\d+$/.test(lastSegment) ? parseInt(lastSegment, 10) : lastSegment) : undefined,
                    message: `${singularName.charAt(0).toUpperCase() + singularName.slice(1)} deleted successfully`
                }
            };
        }
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: { success: true }
        };
    }
    /**
     * Safely proxies an unknown request to the real backend in Hybrid mode.
     */
    static async proxyToRealBackend(reqUrl, method, headers, body, backendBaseUrl) {
        return new Promise((resolve) => {
            try {
                const targetBase = backendBaseUrl.replace(/\/+$/, '');
                const targetFullUrl = new url_1.URL(reqUrl, targetBase);
                const isHttps = targetFullUrl.protocol === 'https:';
                const client = isHttps ? https : http;
                const forwardHeaders = {};
                for (const [k, v] of Object.entries(headers)) {
                    if (!v || ['host', 'connection', 'content-length'].includes(k.toLowerCase()))
                        continue;
                    forwardHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
                }
                let bodyPayload;
                if (body) {
                    const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
                    bodyPayload = Buffer.from(bodyStr, 'utf-8');
                    forwardHeaders['content-type'] = 'application/json';
                    forwardHeaders['content-length'] = String(bodyPayload.length);
                }
                const options = {
                    hostname: targetFullUrl.hostname,
                    port: targetFullUrl.port || (isHttps ? 443 : 80),
                    path: targetFullUrl.pathname + targetFullUrl.search,
                    method: method.toUpperCase(),
                    headers: forwardHeaders,
                    timeout: 6000
                };
                const proxyReq = client.request(options, (proxyRes) => {
                    let rawData = '';
                    proxyRes.on('data', (chunk) => (rawData += chunk));
                    proxyRes.on('end', () => {
                        let parsedBody = rawData;
                        try {
                            parsedBody = JSON.parse(rawData);
                        }
                        catch {
                            // keep string
                        }
                        const resHeaders = {};
                        for (const [hk, hv] of Object.entries(proxyRes.headers)) {
                            if (hv)
                                resHeaders[hk] = Array.isArray(hv) ? hv.join(', ') : hv;
                        }
                        resolve({
                            status: proxyRes.statusCode || 200,
                            headers: resHeaders,
                            body: parsedBody
                        });
                    });
                });
                proxyReq.on('error', (err) => {
                    output_channel_1.logger.warn(`Proxy request failed to ${backendBaseUrl}: ${err.message}. Falling back to synthetic response.`);
                    const fallback = CompatibilityLayer.synthesizeMockResponse(method, targetFullUrl.pathname, {}, body);
                    resolve(fallback);
                });
                proxyReq.on('timeout', () => {
                    proxyReq.destroy();
                    output_channel_1.logger.warn(`Proxy request timed out to ${backendBaseUrl}. Falling back to synthetic response.`);
                    const fallback = CompatibilityLayer.synthesizeMockResponse(method, targetFullUrl.pathname, {}, body);
                    resolve(fallback);
                });
                if (bodyPayload) {
                    proxyReq.write(bodyPayload);
                }
                proxyReq.end();
            }
            catch (err) {
                output_channel_1.logger.error(`Error in proxy forwarder: ${err}`);
                const fallback = CompatibilityLayer.synthesizeMockResponse(method, reqUrl, {}, body);
                resolve(fallback);
            }
        });
    }
    /**
     * Merges newly captured response fields with an existing mock response to preserve backward compatibility.
     */
    static mergeResponseFields(existingBody, newBody) {
        if (typeof existingBody !== 'object' || existingBody === null)
            return newBody;
        if (typeof newBody !== 'object' || newBody === null)
            return existingBody;
        if (Array.isArray(existingBody) && Array.isArray(newBody)) {
            // Merge unique items by id
            const merged = [...existingBody];
            for (const newItem of newBody) {
                if (typeof newItem === 'object' && newItem !== null && 'id' in newItem) {
                    const idx = merged.findIndex((m) => typeof m === 'object' && m !== null && m.id === newItem.id);
                    if (idx >= 0) {
                        merged[idx] = { ...merged[idx], ...newItem };
                    }
                    else {
                        merged.push(newItem);
                    }
                }
                else {
                    merged.push(newItem);
                }
            }
            return merged;
        }
        const mergedObj = { ...existingBody };
        for (const [key, value] of Object.entries(newBody)) {
            if (!(key in mergedObj)) {
                mergedObj[key] = value;
            }
            else if (typeof mergedObj[key] === 'object' && typeof value === 'object') {
                mergedObj[key] = CompatibilityLayer.mergeResponseFields(mergedObj[key], value);
            }
        }
        return mergedObj;
    }
}
exports.CompatibilityLayer = CompatibilityLayer;
//# sourceMappingURL=compatibility-layer.js.map