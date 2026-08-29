import * as http from 'http';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { CapturedRequest, CapturedResponse, RequestTiming, redactHeaders } from '../models/captured-request';
import { logger } from '../logging/output-channel';

export interface CdpTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface PendingRequestState {
  id: string;
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  postData?: string;
  startTime: number;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
  };
}

export class BrowserRecorder extends EventEmitter {
  private isRecording = false;
  private ws: WebSocket | null = null;
  private browserProcess: child_process.ChildProcess | null = null;
  private messageId = 0;
  private pendingCdpRequests = new Map<number, (res: any) => void>();
  private activeRequests = new Map<string, PendingRequestState>();
  private capturedRequests: CapturedRequest[] = [];
  private redactHeaderNames: string[] = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'apikey'];
  private cdpPort = 9222;

  constructor(cdpPort = 9222, redactHeadersList?: string[]) {
    super();
    this.cdpPort = cdpPort;
    if (redactHeadersList) {
      this.redactHeaderNames = redactHeadersList;
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getCapturedRequests(): CapturedRequest[] {
    return [...this.capturedRequests];
  }

  public clearCaptured(): void {
    this.capturedRequests = [];
    this.activeRequests.clear();
    this.emit('cleared');
  }

  /**
   * Starts browser recording session by connecting to Chrome CDP or launching a debugging instance.
   */
  public async startRecording(targetUrl = 'http://localhost:3000'): Promise<boolean> {
    if (this.isRecording) {
      logger.warn('Browser recording session is already active.');
      return true;
    }

    logger.info(`Starting browser recording on port ${this.cdpPort}...`);

    // 1. Attempt to connect to existing Chrome debugging instance
    let target = await this.findCdpTarget();

    // 2. If no Chrome is running, attempt to launch Chrome with remote debugging
    if (!target) {
      logger.info('No running Chrome DevTools instance found. Launching Chrome with remote debugging...');
      await this.launchChrome(targetUrl);
      // Wait for Chrome to spin up DevTools port
      await new Promise((resolve) => setTimeout(resolve, 1500));
      target = await this.findCdpTarget();
    }

    if (!target || !target.webSocketDebuggerUrl) {
      logger.error('Could not connect to Chrome DevTools Protocol. Make sure Chrome is installed or launch it with --remote-debugging-port=9222.');
      throw new Error('Could not connect to Chrome DevTools Protocol on port ' + this.cdpPort);
    }

    // 3. Connect via WebSocket to DevTools target
    await this.connectCdpWebSocket(target.webSocketDebuggerUrl);

    // 4. Enable Network domain
    await this.sendCdpCommand('Network.enable', {
      maxTotalBufferSize: 50000000,
      maxResourceBufferSize: 10000000
    });

    this.isRecording = true;
    logger.info(`TrafficGhost Browser Recorder active. Capturing network traffic on: ${target.url || targetUrl}`);
    this.emit('started');
    return true;
  }

  /**
   * Stops the browser recording session and returns all captured requests.
   */
  public async stopRecording(): Promise<CapturedRequest[]> {
    if (!this.isRecording) {
      return this.capturedRequests;
    }

    this.isRecording = false;

    if (this.ws) {
      try {
        await this.sendCdpCommand('Network.disable', {});
      } catch {
        // ignore
      }
      this.ws.close();
      this.ws = null;
    }

    if (this.browserProcess) {
      try {
        this.browserProcess.kill();
      } catch {
        // ignore
      }
      this.browserProcess = null;
    }

    logger.info(`Browser recording stopped. Total captured requests: ${this.capturedRequests.length}`);
    this.emit('stopped', this.capturedRequests);
    return this.capturedRequests;
  }

  private async findCdpTarget(): Promise<CdpTarget | null> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.cdpPort}/json/list`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const targets = JSON.parse(data) as CdpTarget[];
            // Prefer 'page' targets with a websocket url
            const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
            resolve(pageTarget || targets[0] || null);
          } catch {
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

  private async launchChrome(url: string): Promise<void> {
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

    for (const binPath of candidatePaths) {
      try {
        const proc = child_process.spawn(binPath, chromeArgs, {
          detached: true,
          stdio: 'ignore'
        });
        proc.unref();
        this.browserProcess = proc;
        return;
      } catch {
        continue;
      }
    }
  }

  private connectCdpWebSocket(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        resolve();
      });

      this.ws.on('error', (err) => {
        logger.error(`CDP WebSocket error: ${err.message}`);
        reject(err);
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id && this.pendingCdpRequests.has(msg.id)) {
            const resolver = this.pendingCdpRequests.get(msg.id)!;
            this.pendingCdpRequests.delete(msg.id);
            resolver(msg.result);
          } else if (msg.method) {
            await this.handleCdpEvent(msg.method, msg.params);
          }
        } catch (err) {
          logger.warn(`Error handling CDP message: ${err}`);
        }
      });
    });
  }

  private sendCdpCommand(method: string, params: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('CDP WebSocket is not connected.'));
      }

      const id = ++this.messageId;
      this.pendingCdpRequests.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  private async handleCdpEvent(method: string, params: any): Promise<void> {
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
    } else if (method === 'Network.responseReceived') {
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
    } else if (method === 'Network.loadingFinished') {
      const reqId = params.requestId;
      const pending = this.activeRequests.get(reqId);
      if (!pending) return;

      this.activeRequests.delete(reqId);

      // Attempt to retrieve response body
      let responseBody: unknown = null;
      let isBase64 = false;

      try {
        const bodyRes = await this.sendCdpCommand('Network.getResponseBody', { requestId: reqId });
        if (bodyRes && bodyRes.body) {
          isBase64 = Boolean(bodyRes.base64Encoded);
          let rawText = bodyRes.body;
          if (isBase64) {
            try {
              rawText = Buffer.from(rawText, 'base64').toString('utf-8');
            } catch {
              // keep as is
            }
          }
          try {
            responseBody = JSON.parse(rawText);
          } catch {
            responseBody = rawText;
          }
        }
      } catch {
        // Body retrieval may fail for certain resource types or aborted requests
      }

      // Parse request body
      let parsedReqBody: unknown = pending.postData;
      if (pending.postData) {
        try {
          parsedReqBody = JSON.parse(pending.postData);
        } catch {
          parsedReqBody = pending.postData;
        }
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(pending.url);
      } catch {
        try {
          parsedUrl = new URL(pending.url, 'http://localhost');
        } catch {
          return;
        }
      }

      const query: Record<string, string> = {};
      parsedUrl.searchParams.forEach((val, key) => {
        query[key] = val;
      });

      const finishTime = params.timestamp ? params.timestamp * 1000 : Date.now();
      const duration = Math.max(1, Math.round(finishTime - pending.startTime));

      const capturedResponse: CapturedResponse = {
        status: pending.response?.status || 200,
        statusText: pending.response?.statusText || 'OK',
        headers: redactHeaders(pending.response?.headers || {}, this.redactHeaderNames),
        body: responseBody,
        contentType: pending.response?.mimeType || 'application/json',
        isBase64
      };

      const normalized: CapturedRequest = {
        id: pending.id,
        method: pending.method,
        url: pending.url,
        protocol: parsedUrl.protocol.replace(':', ''),
        host: parsedUrl.host,
        path: parsedUrl.pathname,
        query,
        headers: redactHeaders(pending.headers, this.redactHeaderNames),
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
      logger.info(`[Recorded] ${normalized.method} ${normalized.path} -> ${normalized.response.status} (${duration}ms)`);
    }
  }
}
