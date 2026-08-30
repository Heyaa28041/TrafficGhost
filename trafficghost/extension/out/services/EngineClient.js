"use strict";
// TrafficGhost — Engine HTTP Client
// Typed wrapper around the Control API on :4001
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
exports.EngineClient = void 0;
const http = __importStar(require("http"));
class EngineClient {
    constructor(port = 4001) {
        this.baseUrl = `http://localhost:${port}`;
    }
    async isReachable() {
        try {
            const res = await this.get("/health");
            return res.ok === true;
        }
        catch {
            return false;
        }
    }
    async getProject() {
        return this.get("/project");
    }
    async importHarFile(filePath) {
        return this.post("/import/har", { filePath });
    }
    async importHarJson(harJson, source) {
        return this.post("/import/har-json", { harJson, source });
    }
    async analyze() {
        return this.post("/analyze", {});
    }
    async generateMocks() {
        return this.post("/generate", {});
    }
    async startMockServer(port) {
        return this.post("/mock/start", port ? { port } : {});
    }
    async stopMockServer() {
        return this.post("/mock/stop", {});
    }
    async getMockStatus() {
        return this.get("/mock/status");
    }
    async getRequestLog() {
        return this.get("/mock/logs");
    }
    async startProxy(port) {
        return this.post("/proxy/start", port ? { port } : {});
    }
    async stopProxy() {
        return this.post("/proxy/stop", {});
    }
    async setBehavior(config) {
        return this.put("/behavior", config);
    }
    async setChaosMode(enabled, config) {
        return this.put("/behavior/chaos", { enabled, config });
    }
    async resetProject() {
        return this.post("/project/reset", {});
    }
    async get(path) {
        return new Promise((resolve, reject) => {
            const req = http.get(`${this.baseUrl}${path}`, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(parsed.error ?? `HTTP ${res.statusCode}`));
                        }
                        else {
                            resolve(parsed);
                        }
                    }
                    catch {
                        reject(new Error(`Invalid JSON from engine: ${data.substring(0, 100)}`));
                    }
                });
            });
            req.on("error", reject);
            req.setTimeout(10000, () => { req.destroy(); reject(new Error("Engine request timed out.")); });
        });
    }
    async post(path, body) {
        return this.request("POST", path, body);
    }
    async put(path, body) {
        return this.request("PUT", path, body);
    }
    async request(method, path, body) {
        return new Promise((resolve, reject) => {
            const payload = body !== undefined ? JSON.stringify(body) : "";
            const options = {
                hostname: "localhost",
                port: parseInt(this.baseUrl.split(":")[2]),
                path,
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload),
                },
            };
            const req = http.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(parsed.error ?? `HTTP ${res.statusCode}`));
                        }
                        else {
                            resolve(parsed);
                        }
                    }
                    catch {
                        reject(new Error(`Invalid JSON from engine: ${data.substring(0, 100)}`));
                    }
                });
            });
            req.on("error", reject);
            req.setTimeout(15000, () => { req.destroy(); reject(new Error("Engine request timed out.")); });
            req.write(payload);
            req.end();
        });
    }
    // ─── Exasol AI ────────────────────────────────────────────────────────────
    async updateSettings(settings) {
        return this.put("/settings", settings);
    }
    async getExasolStatus() {
        return this.get("/exasol/status");
    }
    async aiQuery(question, apiKey) {
        return this.post("/exasol/ai-query", { question, apiKey });
    }
    async syncToExasol() {
        return this.post("/exasol/sync", {});
    }
    async getExasolStats() {
        return this.get("/exasol/stats");
    }
}
exports.EngineClient = EngineClient;
//# sourceMappingURL=EngineClient.js.map