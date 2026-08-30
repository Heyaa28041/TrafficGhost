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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserRecorder = void 0;
const http = __importStar(require("http"));
const child_process = __importStar(require("child_process"));
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const captured_request_1 = require("../models/captured-request");
const output_channel_1 = require("../logging/output-channel");
class BrowserRecorder extends events_1.EventEmitter {
    isRecording = false;
    ws = null;
    browserProcess = null;
    messageId = 0;
    pendingCdpRequests = new Map();
    activeRequests = new Map();
    capturedRequests = [];
    redactHeaderNames = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey'];
    cdpPort = 9222;
    constructor(cdpPort = 9222, redactHeadersList) {
        super();
        this.cdpPort = cdpPort;
        if (redactHeadersList) {
            this.redactHeaderNames = redactHeadersList;
        }
    }
    getIsRecording() {
        return this.isRecording;
    }
    getCapturedRequests() {
        return [...this.capturedRequests];
    }
    clearCaptured() {
        this.capturedRequests = [];
        this.activeRequests.clear();
        this.emit('cleared');
    }
    /**
     * Starts browser recording session by connecting to Chrome CDP or launching a debugging instance.
     */
    async startRecording(targetUrl = 'http://localhost:3000') {
        if (this.isRecording) {
            output_channel_1.logger.warn('Browser recording session is already active.');
            return true;
        }
        output_channel_1.logger.info(`Starting browser recording on port ${this.cdpPort}...`);
        // 1. Attempt to connect to existing Chrome debugging instance
        let target = await this.findCdpTarget();
        // 2. If no Chrome is running, attempt to launch Chrome with remote debugging
        if (!target) {
            output_channel_1.logger.info('No running Chrome DevTools instance found. Launching Chrome with remote debugging...');
            try {
                await this.launchChrome(targetUrl);
                // Wait for Chrome to spin up DevTools port
                await new Promise((resolve) => setTimeout(resolve, 2000));
                target = await this.findCdpTarget();
            }
            catch (err) {
                throw new Error('Chrome executable not found');
            }
        }
        if (!target || !target.webSocketDebuggerUrl) {
            throw new Error('CDP unavailable');
        }
        // 3. Connect via WebSocket to DevTools target
        await this.connectCdpWebSocket(target.webSocketDebuggerUrl);
        // 4. Enable Network domain
        await this.sendCdpCommand('Network.enable', {
            maxTotalBufferSize: 50000000,
            maxResourceBufferSize: 10000000
        });
        this.isRecording = true;
        output_channel_1.logger.info(`TrafficGhost Browser Recorder active. Capturing network traffic on: ${target.url || targetUrl}`);
        this.emit('started');
        return true;
    }
    /**
     * Stops the browser recording session and returns all captured requests.
     */
    async stopRecording() {
        if (!this.isRecording) {
            return this.capturedRequests;
        }
        this.isRecording = false;
        if (this.ws) {
            try {
                await this.sendCdpCommand('Network.disable', {});
            }
            catch {
                // ignore
            }
            this.ws.close();
            this.ws = null;
        }
        if (this.browserProcess) {
            try {
                this.browserProcess.kill();
            }
            catch {
                // ignore
            }
            this.browserProcess = null;
        }
        output_channel_1.logger.info(`Browser recording stopped. Total captured requests: ${this.capturedRequests.length}`);
        this.emit('stopped', this.capturedRequests);
        return this.capturedRequests;
    }
    async findCdpTarget() {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${this.cdpPort}/json/list`, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const targets = JSON.parse(data);
                        // Prefer 'page' targets with a websocket url
                        const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
                        resolve(pageTarget || targets[0] || null);
                    }
                    catch {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(null);
            });
        });
    }
    async launchChrome(url) {
        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        const winPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        const macPaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ];
        const linuxPaths = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
        const candidatePaths = isWindows ? winPaths : isMac ? macPaths : linuxPaths;
        const chromeArgs = [
            `--remote-debugging-port=${this.cdpPort}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--user-data-dir=' + (process.env.TEMP || '/tmp') + '/trafficghost-chrome-profile',
            url
        ];
        let launched = false;
        for (const binPath of candidatePaths) {
            try {
                const proc = child_process.spawn(binPath, chromeArgs, {
                    detached: true,
                    stdio: 'ignore'
                });
                proc.unref();
                this.browserProcess = proc;
                launched = true;
                return;
            }
            catch {
                continue;
            }
        }
        if (!launched) {
            throw new Error('Chrome executable not found');
        }
    }
    connectCdpWebSocket(wsUrl) {
        return new Promise((resolve, reject) => {
            this.ws = new ws_1.default(wsUrl);
            this.ws.on('open', () => {
                resolve();
            });
            this.ws.on('error', (err) => {
                output_channel_1.logger.error(`CDP WebSocket error: ${err.message}`);
                reject(err);
            });
            this.ws.on('message', async (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id && this.pendingCdpRequests.has(msg.id)) {
                        const resolver = this.pendingCdpRequests.get(msg.id);
                        this.pendingCdpRequests.delete(msg.id);
                        resolver(msg.result);
                    }
                    else if (msg.method) {
                        await this.handleCdpEvent(msg.method, msg.params);
                    }
                }
                catch (err) {
                    output_channel_1.logger.warn(`Error handling CDP message: ${err}`);
                }
            });
        });
    }
    sendCdpCommand(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
                return reject(new Error('CDP WebSocket is not connected.'));
            }
            const id = ++this.messageId;
            this.pendingCdpRequests.set(id, resolve);
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async handleCdpEvent(method, params) {
        if (method === 'Network.requestWillBeSent') {
            const req = params.request;
            const reqId = params.requestId;
            const url = req.url;
            // Filter out data URLs and chrome extensions
            if (url.startsWith('data:') || url.startsWith('chrome-extension:') || url.startsWith('devtools:')) {
                return;
            }
            this.activeRequests.set(reqId, {
                id: `cdp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                requestId: reqId,
                method: (req.method || 'GET').toUpperCase(),
                url: req.url,
                headers: req.headers || {},
                postData: req.postData,
                startTime: params.timestamp ? params.timestamp * 1000 : Date.now()
            });
        }
        else if (method === 'Network.responseReceived') {
            const reqId = params.requestId;
            const res = params.response;
            const pending = this.activeRequests.get(reqId);
            if (pending && res) {
                pending.response = {
                    status: res.status,
                    statusText: res.statusText,
                    headers: res.headers || {},
                    mimeType: res.mimeType || ''
                };
            }
        }
        else if (method === 'Network.loadingFinished') {
            const reqId = params.requestId;
            const pending = this.activeRequests.get(reqId);
            if (!pending)
                return;
            this.activeRequests.delete(reqId);
            // Attempt to retrieve response body
            let responseBody = null;
            let isBase64 = false;
            try {
                const bodyRes = await this.sendCdpCommand('Network.getResponseBody', { requestId: reqId });
                if (bodyRes && bodyRes.body) {
                    isBase64 = Boolean(bodyRes.base64Encoded);
                    let rawText = bodyRes.body;
                    if (isBase64) {
                        try {
                            rawText = Buffer.from(rawText, 'base64').toString('utf-8');
                        }
                        catch {
                            // keep as is
                        }
                    }
                    try {
                        responseBody = JSON.parse(rawText);
                    }
                    catch {
                        responseBody = rawText;
                    }
                }
            }
            catch {
                // Body retrieval may fail for certain resource types or aborted requests
            }
            // Parse request body
            let parsedReqBody = pending.postData;
            if (pending.postData) {
                try {
                    parsedReqBody = JSON.parse(pending.postData);
                }
                catch {
                    parsedReqBody = pending.postData;
                }
            }
            let parsedUrl;
            try {
                parsedUrl = new URL(pending.url);
            }
            catch {
                try {
                    parsedUrl = new URL(pending.url, 'http://localhost');
                }
                catch {
                    return;
                }
            }
            const query = {};
            parsedUrl.searchParams.forEach((val, key) => {
                query[key] = val;
            });
            const finishTime = params.timestamp ? params.timestamp * 1000 : Date.now();
            const duration = Math.max(1, Math.round(finishTime - pending.startTime));
            const capturedResponse = {
                status: pending.response?.status || 200,
                statusText: pending.response?.statusText || 'OK',
                headers: (0, captured_request_1.redactHeaders)(pending.response?.headers || {}, this.redactHeaderNames),
                body: responseBody,
                contentType: pending.response?.mimeType || 'application/json',
                isBase64
            };
            const normalized = {
                id: pending.id,
                method: pending.method,
                url: pending.url,
                protocol: parsedUrl.protocol.replace(':', ''),
                host: parsedUrl.host,
                path: parsedUrl.pathname,
                query,
                headers: (0, captured_request_1.redactHeaders)(pending.headers, this.redactHeaderNames),
                body: parsedReqBody,
                response: capturedResponse,
                timing: {
                    start: pending.startTime,
                    duration
                },
                timestamp: pending.startTime
            };
            this.capturedRequests.push(normalized);
            this.emit('captured', normalized);
            output_channel_1.logger.info(`[Recorded] ${normalized.method} ${normalized.path} -> ${normalized.response.status} (${duration}ms)`);
        }
    }
}
exports.BrowserRecorder = BrowserRecorder;
//# sourceMappingURL=browser-recorder.js.map