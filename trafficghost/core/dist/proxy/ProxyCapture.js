// TrafficGhost — HTTP Proxy Capture (P1)
// Lightweight HTTP forward proxy that records traffic into TrafficRecord[].
// HTTP-only for MVP. Full HTTPS MITM requires cert management (out of scope).
import * as http from "http";
import * as https from "https";
import { randomUUID } from "crypto";
export class ProxyCapture {
    server = null;
    port = 7777;
    running = false;
    onTraffic;
    constructor(onTraffic) {
        this.onTraffic = onTraffic;
    }
    isRunning() {
        return this.running;
    }
    getPort() {
        return this.port;
    }
    async start(port = 7777) {
        if (this.running) {
            throw new Error(`Proxy already running on port ${this.port}.`);
        }
        this.port = port;
        this.server = http.createServer((clientReq, clientRes) => {
            this.handleRequest(clientReq, clientRes);
        });
        await new Promise((resolve, reject) => {
            this.server.listen(port, "0.0.0.0", () => resolve());
            this.server.on("error", reject);
        });
        this.running = true;
        console.log(`[TrafficGhost] Proxy capturing on http://localhost:${port}`);
        console.log("[TrafficGhost] Configure your browser to use this proxy for HTTP traffic.");
    }
    async stop() {
        if (!this.running || !this.server) {
            throw new Error("Proxy is not running.");
        }
        await new Promise((resolve) => this.server.close(() => resolve()));
        this.server = null;
        this.running = false;
        console.log("[TrafficGhost] Proxy stopped.");
    }
    handleRequest(clientReq, clientRes) {
        const url = clientReq.url ?? "/";
        const method = clientReq.method ?? "GET";
        let targetUrl;
        try {
            targetUrl = new URL(url.startsWith("http") ? url : `http://${clientReq.headers.host}${url}`);
        }
        catch {
            clientRes.writeHead(400);
            clientRes.end("Bad Request");
            return;
        }
        const startTime = Date.now();
        const chunks = [];
        clientReq.on("data", (chunk) => chunks.push(chunk));
        clientReq.on("end", () => {
            const requestBody = Buffer.concat(chunks);
            const requestHeaders = {};
            for (const [k, v] of Object.entries(clientReq.headers)) {
                if (typeof v === "string")
                    requestHeaders[k] = v;
            }
            const options = {
                hostname: targetUrl.hostname,
                port: targetUrl.port || 80,
                path: targetUrl.pathname + targetUrl.search,
                method,
                headers: { ...clientReq.headers, host: targetUrl.host },
            };
            const proxyLib = targetUrl.protocol === "https:" ? https : http;
            const proxyReq = proxyLib.request(options, (proxyRes) => {
                const resChunks = [];
                proxyRes.on("data", (chunk) => resChunks.push(chunk));
                proxyRes.on("end", () => {
                    const responseBody = Buffer.concat(resChunks);
                    const durationMs = Date.now() - startTime;
                    // Forward response to client
                    clientRes.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
                    clientRes.end(responseBody);
                    // Record traffic
                    const responseHeaders = {};
                    for (const [k, v] of Object.entries(proxyRes.headers)) {
                        if (typeof v === "string")
                            responseHeaders[k] = v;
                    }
                    let parsedReqBody = undefined;
                    if (requestBody.length > 0) {
                        try {
                            parsedReqBody = JSON.parse(requestBody.toString("utf-8"));
                        }
                        catch {
                            parsedReqBody = requestBody.toString("utf-8");
                        }
                    }
                    let parsedResBody = undefined;
                    if (responseBody.length > 0) {
                        try {
                            parsedResBody = JSON.parse(responseBody.toString("utf-8"));
                        }
                        catch {
                            parsedResBody = responseBody.toString("utf-8");
                        }
                    }
                    const query = {};
                    targetUrl.searchParams.forEach((v, k) => { query[k] = v; });
                    const record = {
                        id: randomUUID(),
                        method: method.toUpperCase(),
                        url: targetUrl.toString(),
                        host: targetUrl.hostname,
                        path: targetUrl.pathname,
                        query,
                        requestHeaders,
                        requestBody: parsedReqBody,
                        responseStatus: proxyRes.statusCode ?? 200,
                        responseHeaders,
                        responseBody: parsedResBody,
                        responseMimeType: proxyRes.headers["content-type"] ?? undefined,
                        timing: { startedAt: startTime, durationMs },
                        source: "proxy",
                    };
                    this.onTraffic(record);
                });
            });
            proxyReq.on("error", () => {
                clientRes.writeHead(502);
                clientRes.end("Bad Gateway");
            });
            if (requestBody.length > 0) {
                proxyReq.write(requestBody);
            }
            proxyReq.end();
        });
    }
}
//# sourceMappingURL=ProxyCapture.js.map