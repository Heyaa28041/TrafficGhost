// TrafficGhost — Dashboard WebviewPanel
// Full-screen panel opened after mock server starts. Shows advanced controls.

import * as vscode from "vscode";
import { EngineClient, BehaviorConfig } from "../services/EngineClient";

export class DashboardPanel {
  private static current: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private pollInterval: NodeJS.Timeout | undefined;
  private disposed = false;

  static createOrShow(
    extensionUri: vscode.Uri,
    client: EngineClient
  ): DashboardPanel {
    const col = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DashboardPanel.current && !DashboardPanel.current.disposed) {
      DashboardPanel.current.panel.reveal(col);
      return DashboardPanel.current;
    }

    const panel = vscode.window.createWebviewPanel(
      "trafficghost.dashboard",
      "👻 TrafficGhost Dashboard",
      col,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    DashboardPanel.current = new DashboardPanel(panel, client);
    return DashboardPanel.current;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly client: EngineClient
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      await this.handleMessage(msg);
    });

    this.panel.onDidDispose(() => {
      this.disposed = true;
      this.stopPolling();
      DashboardPanel.current = undefined;
    });

    this.startPolling();
  }

  private async handleMessage(msg: {
    command: string;
    latencyMs?: number;
    latencyRandom?: boolean;
    chaosEnabled?: boolean;
    errorRates?: BehaviorConfig["errorRates"];
    path?: string;
    method?: string;
    body?: string;
    // Exasol AI
    question?: string;
    apiKey?: string;
  }): Promise<void> {
    switch (msg.command) {
      case "setBehavior": {
        const config: BehaviorConfig = {};
        if (msg.latencyMs !== undefined) config.latencyMs = msg.latencyMs;
        if (msg.latencyRandom !== undefined) config.latencyRandom = msg.latencyRandom;
        if (msg.errorRates) config.errorRates = msg.errorRates;
        await this.client.setBehavior(config);
        break;
      }
      case "setChaos": {
        await this.client.setChaosMode(msg.chaosEnabled ?? false);
        this.pushUpdate();
        break;
      }
      case "testEndpoint": {
        if (!msg.path || !msg.method) break;
        try {
          const status = await this.client.getMockStatus();
          if (!status.running || !status.url) break;
          const url = `${status.url}${msg.path}`;
          const res = await fetch(url, {
            method: msg.method,
            headers: { "Content-Type": "application/json" },
            body: msg.body && msg.method !== "GET" ? msg.body : undefined,
          });
          const body = await res.text();
          this.panel.webview.postMessage({
            type: "testResult",
            status: res.status,
            body: body.substring(0, 2000),
            ok: res.ok,
          });
        } catch (e) {
          this.panel.webview.postMessage({
            type: "testResult",
            error: (e as Error).message,
          });
        }
        break;
      }
      case "refresh":
        this.pushUpdate();
        break;
      case "copyUrl": {
        if (msg.path) {
          await vscode.env.clipboard.writeText(msg.path);
          vscode.window.showInformationMessage(`Copied: ${msg.path}`);
        }
        break;
      }
      // ── Exasol AI ──────────────────────────────────────────────────────────
      case "exasolStatus": {
        try {
          const status = await this.client.getExasolStatus();
          this.panel.webview.postMessage({ type: "exasolStatus", ...status });
        } catch {
          this.panel.webview.postMessage({ type: "exasolStatus", connected: false });
        }
        break;
      }
      case "aiQuery": {
        if (!msg.question) break;
        this.panel.webview.postMessage({ type: "aiLoading", loading: true });
        try {
          const result = await this.client.aiQuery(msg.question, msg.apiKey);
          this.panel.webview.postMessage({ type: "aiResult", ...result });
        } catch (e) {
          this.panel.webview.postMessage({
            type: "aiResult",
            question: msg.question,
            sql: "",
            columns: [],
            rows: [],
            error: (e as Error).message,
            durationMs: 0,
          });
        } finally {
          this.panel.webview.postMessage({ type: "aiLoading", loading: false });
        }
        break;
      }
      case "syncExasol": {
        try {
          const result = await this.client.syncToExasol();
          this.panel.webview.postMessage({ type: "syncResult", ...result });
          // Refresh status after sync
          const status = await this.client.getExasolStatus();
          this.panel.webview.postMessage({ type: "exasolStatus", ...status });
        } catch (e) {
          this.panel.webview.postMessage({ type: "syncResult", ok: false, error: (e as Error).message });
        }
        break;
      }
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pushUpdate();
    this.pollInterval = setInterval(() => this.pushUpdate(), 2000);
  }

  private stopPolling(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private async pushUpdate(): Promise<void> {
    if (this.disposed) return;
    try {
      const [project, mockStatus, logs] = await Promise.all([
        this.client.getProject(),
        this.client.getMockStatus(),
        this.client.getRequestLog(),
      ]);
      this.panel.webview.postMessage({
        type: "update",
        project,
        mockStatus,
        logs: logs.slice(0, 50),
      });
    } catch {
      // Engine not available
    }
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https:; connect-src http://localhost:* https:;">
<title>TrafficGhost Dashboard</title>
<style>
:root {
  --bg: #0d0d1a;
  --bg2: #131326;
  --bg3: #1a1a35;
  --accent: #7c6af7;
  --accent2: #00d4aa;
  --success: #40c078;
  --warn: #f0b040;
  --danger: #f07070;
  --fg: #e0e0e0;
  --fg2: #a0a0b8;
  --border: rgba(124,106,247,0.18);
  --font: 'Segoe UI', system-ui, sans-serif;
  --mono: 'Cascadia Code', 'Consolas', monospace;
  --radius: 10px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Top bar */
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.topbar-brand { font-size: 20px; line-height: 1; }
.topbar-title {
  font-weight: 700;
  font-size: 15px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.topbar-url {
  font-family: var(--mono);
  font-size: 12px;
  background: rgba(0,212,170,0.1);
  color: var(--accent2);
  border: 1px solid rgba(0,212,170,0.3);
  padding: 3px 10px;
  border-radius: 100px;
  cursor: pointer;
  margin-left: auto;
}
.topbar-url:hover { background: rgba(0,212,170,0.18); }
.status-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
  animation: blink 2s infinite;
  flex-shrink: 0;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.5} }

/* Layout */
.layout {
  display: grid;
  grid-template-columns: 300px 1fr 260px;
  flex: 1;
  overflow: hidden;
  gap: 0;
}

/* Panels */
.panel {
  overflow-y: auto;
  padding: 16px;
  border-right: 1px solid var(--border);
}
.panel:last-child { border-right: none; }
.panel-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--fg2);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

/* API List */
.endpoint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 3px;
  transition: background 0.1s;
  border: 1px solid transparent;
}
.endpoint-item:hover, .endpoint-item.active {
  background: rgba(124,106,247,0.1);
  border-color: var(--border);
}
.method-badge {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  min-width: 44px;
  text-align: center;
}
.m-GET    { background: rgba(64,192,120,0.2); color: #40c078; }
.m-POST   { background: rgba(240,176,64,0.2); color: #f0b040; }
.m-PUT    { background: rgba(100,160,240,0.2); color: #64a0f0; }
.m-PATCH  { background: rgba(200,100,220,0.2); color: #c864dc; }
.m-DELETE { background: rgba(240,112,112,0.2); color: #f07070; }
.endpoint-path { font-family: var(--mono); font-size: 11px; color: var(--fg); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge-dyn { font-size: 9px; color: var(--accent2); background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.2); padding: 1px 5px; border-radius: 100px; }
.badge-pag { font-size: 9px; color: var(--warn); background: rgba(240,176,64,0.1); border: 1px solid rgba(240,176,64,0.2); padding: 1px 5px; border-radius: 100px; }

/* Center pane — detail + logs */
.center-pane { display: flex; flex-direction: column; overflow: hidden; }
.detail-section { padding: 16px; border-bottom: 1px solid var(--border); }
.log-section { flex: 1; overflow-y: auto; padding: 16px; }

/* Log entries */
.log-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
  font-family: var(--mono);
  font-size: 11px;
  transition: background 0.1s;
}
.log-row:hover { background: rgba(255,255,255,0.04); }
.log-time { color: var(--fg2); flex-shrink: 0; }
.log-method { font-weight: 700; flex-shrink:0; min-width: 44px; }
.log-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
.log-status { flex-shrink: 0; font-weight: 700; }
.log-dur { color: var(--fg2); flex-shrink: 0; }
.s-2xx { color: var(--success); }
.s-4xx { color: var(--warn); }
.s-5xx { color: var(--danger); }
.log-empty { color: var(--fg2); text-align: center; padding: 24px; }

/* Right panel — behavior controls */
.control-section { margin-bottom: 16px; }
.control-label {
  font-size: 11px;
  color: var(--fg2);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.control-value { color: var(--accent); font-weight: 600; }

.slider {
  width: 100%;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 2px;
  background: var(--bg3);
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 0 6px rgba(124,106,247,0.6);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}
.toggle-label { font-size: 12px; }

/* Toggle switch */
.toggle {
  position: relative;
  width: 36px; height: 20px;
  flex-shrink: 0;
}
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-track {
  position: absolute; cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #333;
  border-radius: 20px;
  transition: background 0.2s;
}
.toggle input:checked + .toggle-track { background: var(--accent); }
.toggle-track::before {
  content: '';
  position: absolute;
  left: 3px; bottom: 3px;
  width: 14px; height: 14px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle input:checked + .toggle-track::before { transform: translateX(16px); }

/* Chaos mode */
.chaos-card {
  background: linear-gradient(135deg, rgba(240,112,112,0.08), rgba(240,176,64,0.08));
  border: 1px solid rgba(240,112,112,0.2);
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 12px;
}
.chaos-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--danger);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.chaos-desc { font-size: 10px; color: var(--fg2); }

/* Preset buttons */
.presets { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.preset-btn {
  padding: 4px 10px;
  border-radius: 100px;
  border: 1px solid var(--border);
  background: var(--bg3);
  color: var(--fg);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.1s;
  font-family: var(--font);
}
.preset-btn:hover { background: rgba(124,106,247,0.15); border-color: var(--accent); color: var(--accent); }
.preset-btn.active { background: rgba(124,106,247,0.2); border-color: var(--accent); color: var(--accent); }

/* Test endpoint */
.test-area {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  margin-top: 12px;
}
.test-result {
  font-family: var(--mono);
  font-size: 11px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  margin-top: 8px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow-y: auto;
}
.test-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(0,212,170,0.4);
  background: rgba(0,212,170,0.1);
  color: var(--accent2);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font);
  margin-top: 8px;
  transition: all 0.1s;
  width: 100%;
  justify-content: center;
}
.test-btn:hover { background: rgba(0,212,170,0.2); }

/* Stats row */
.stats-row {
  display: flex;
  gap: 12px;
  margin-left: auto;
  align-items: center;
}
.stat-chip {
  font-size: 11px;
  color: var(--fg2);
}
.stat-chip strong { color: var(--fg); }

/* Overview cards */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.ov-card {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}
.ov-val { font-size: 22px; font-weight: 700; color: var(--accent); }
.ov-lab { font-size: 10px; color: var(--fg2); margin-top: 2px; }
.ov-card.dyn .ov-val { color: var(--accent2); }
.ov-card.pag .ov-val { color: var(--warn); }

.empty-state {
  text-align: center;
  color: var(--fg2);
  padding: 32px 16px;
  line-height: 1.6;
}
.empty-icon { font-size: 32px; margin-bottom: 8px; }

.endpoint-detail {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}
.detail-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px; }
.detail-key { font-size: 11px; color: var(--fg2); flex-shrink:0; width: 80px; }
.detail-val { font-family: var(--mono); font-size: 11px; color: var(--fg); word-break: break-all; }

.section-sep { border: none; border-top: 1px solid var(--border); margin: 12px 0; }

/* scrollbar */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(124,106,247,0.3); border-radius: 3px; }
</style>
</head>
<body>

<div class="topbar">
  <span class="topbar-brand">👻</span>
  <span class="topbar-title">TrafficGhost</span>
  <span id="server-dot" class="status-dot" style="display:none"></span>
  <span id="server-url" class="topbar-url" style="display:none" onclick="copyUrl()" title="Click to copy API URL"></span>
  <div class="stats-row" id="topbar-stats"></div>
</div>

<div class="layout">
  <!-- LEFT: API List -->
  <div class="panel" id="api-panel">
    <div class="panel-title">API Endpoints</div>
    <div id="endpoint-list"><div class="empty-state"><div class="empty-icon">🔍</div>No APIs captured yet.<br>Import a HAR file to begin.</div></div>
  </div>

  <!-- CENTER: Detail + Log -->
  <div class="center-pane panel" style="border-right:1px solid var(--border)">
    <div class="detail-section">
      <div class="panel-title">Endpoint Details</div>
      <div id="endpoint-detail">
        <div class="empty-state" style="padding:12px">
          <div class="empty-icon" style="font-size:20px">👈</div>
          Select an endpoint to inspect it.
        </div>
      </div>
    </div>

    <div class="log-section">
      <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center">
        Request Log
        <span id="log-count" style="font-size:10px;color:var(--fg2)"></span>
      </div>
      <div id="request-log"><div class="log-empty">Waiting for requests...</div></div>
    </div>
  </div>

  <!-- RIGHT: Behavior Controls -->
  <div class="panel">
    <div class="panel-title">Behavior Controls</div>

    <!-- Chaos Mode -->
    <div class="chaos-card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div class="chaos-title">💀 Chaos Mode</div>
          <div class="chaos-desc">Force failures across all endpoints</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="chaos-toggle" onchange="onChaosToggle()">
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    <!-- Latency -->
    <div class="control-section">
      <div class="control-label">
        Latency
        <span class="control-value" id="latency-val">0 ms</span>
      </div>
      <input type="range" class="slider" id="latency-slider"
        min="0" max="5000" step="100" value="0"
        oninput="onLatencyChange()" onchange="applyBehavior()">
      <div class="presets" style="margin-top:6px">
        <span class="preset-btn" onclick="setLatency(0)">None</span>
        <span class="preset-btn" onclick="setLatency(100)">100ms</span>
        <span class="preset-btn" onclick="setLatency(300)">300ms</span>
        <span class="preset-btn" onclick="setLatency(800)">800ms</span>
        <span class="preset-btn" onclick="setLatency(2000)">2s</span>
        <span class="preset-btn" onclick="setLatency(5000)">5s</span>
      </div>
    </div>

    <hr class="section-sep">

    <!-- Error Rates -->
    <div class="control-section">
      <div class="control-label">
        500 Internal Error
        <span class="control-value" id="err500-val">0%</span>
      </div>
      <input type="range" class="slider" id="err500-slider"
        min="0" max="100" step="5" value="0"
        oninput="onErrChange('err500')" onchange="applyBehavior()">
    </div>

    <div class="control-section">
      <div class="control-label">
        429 Rate Limited
        <span class="control-value" id="err429-val">0%</span>
      </div>
      <input type="range" class="slider" id="err429-slider"
        min="0" max="100" step="5" value="0"
        oninput="onErrChange('err429')" onchange="applyBehavior()">
    </div>

    <div class="control-section">
      <div class="control-label">
        404 Not Found
        <span class="control-value" id="err404-val">0%</span>
      </div>
      <input type="range" class="slider" id="err404-slider"
        min="0" max="100" step="5" value="0"
        oninput="onErrChange('err404')" onchange="applyBehavior()">
    </div>

    <hr class="section-sep">

    <!-- Demo presets -->
    <div class="control-section">
      <div class="control-label">Demo Presets</div>
      <div class="presets">
        <span class="preset-btn" onclick="applyPreset('clean')">✅ Normal</span>
        <span class="preset-btn" onclick="applyPreset('slow')">🐌 Slow</span>
        <span class="preset-btn" onclick="applyPreset('flaky')">⚡ Flaky</span>
        <span class="preset-btn" onclick="applyPreset('down')">💥 Down</span>
      </div>
    </div>

    <!-- Test endpoint -->
    <hr class="section-sep">
    <div class="control-section">
      <div class="control-label">Test Endpoint</div>
      <div class="test-area">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <select id="test-method" style="background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px;font-size:11px;width:70px">
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
          </select>
          <input id="test-path" type="text" placeholder="/api/users"
            style="flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:4px;font-size:11px;font-family:var(--mono)">
        </div>
        <button class="test-btn" onclick="testEndpoint()">▶ Send Request</button>
        <div id="test-result" class="test-result" style="display:none"></div>
      </div>
    </div>

    <!-- Exasol AI -->
    <hr class="section-sep">
    <div class="control-section">
      <div class="control-label" style="display:flex;align-items:center;justify-content:space-between">
        <span>🤖 Exasol AI Analytics</span>
        <span id="exasol-badge" class="badge-dyn" style="background:rgba(0,180,216,0.15);color:#00b4d8;border:1px solid rgba(0,180,216,0.3);font-size:9px">Checking...</span>
      </div>
      <div style="font-size:10px;color:var(--fg2);margin-bottom:6px">Ask natural language questions about your API traffic using Exasol AI:</div>
      
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <input id="ai-input" type="text" placeholder="e.g. Which endpoints had errors?"
          style="flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:4px;padding:5px;font-size:11px"
          onkeydown="if(event.key==='Enter') askExasol()">
        <button class="preset-btn" style="background:var(--accent);color:#fff;font-weight:600" onclick="askExasol()">Ask</button>
      </div>

      <div class="presets" style="margin-bottom:6px">
        <span class="preset-btn" onclick="askExasol('Which endpoints had errors?')">❌ Errors</span>
        <span class="preset-btn" onclick="askExasol('What is the average response latency?')">⏱ Latency</span>
        <span class="preset-btn" onclick="askExasol('Which endpoint is most called?')">🔥 Popular</span>
        <span class="preset-btn" onclick="askExasol('List status code breakdown')">📊 Status</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
        <button class="preset-btn" style="font-size:10px" onclick="syncExasol()">🔄 Sync Traffic to Exasol</button>
        <span id="sync-msg" style="font-size:10px;color:var(--fg2)"></span>
      </div>

      <div id="ai-result-area" style="display:none;margin-top:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:11px">
        <div id="ai-loading" style="display:none;color:var(--accent);font-weight:600">⚡ Exasol AI generating & running SQL query...</div>
        <div id="ai-output"></div>
      </div>
    </div>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();
let currentProject = null;
let currentStatus = null;
let selectedEndpoint = null;
let endpoints = [];

// ─── Rendering ───────────────────────────────────────────────────────────

function renderAll(project, mockStatus, logs) {
  currentProject = project;
  currentStatus = mockStatus;

  // Top bar
  if (mockStatus?.running && mockStatus.url) {
    document.getElementById('server-dot').style.display = 'block';
    const urlEl = document.getElementById('server-url');
    urlEl.style.display = 'block';
    urlEl.textContent = mockStatus.url;
    urlEl.title = 'Click to copy · ' + mockStatus.url;
  }

  // Stats
  if (project) {
    document.getElementById('topbar-stats').innerHTML = \`
      <span class="stat-chip"><strong>\${project.endpointCount}</strong> APIs</span>
      <span class="stat-chip"><strong>\${project.dynamicRouteCount}</strong> dynamic</span>
      <span class="stat-chip"><strong>\${project.trafficCount}</strong> requests</span>
    \`;
  }

  renderLogs(logs || []);
}

function renderEndpoints(eps) {
  endpoints = eps;
  const list = document.getElementById('endpoint-list');
  if (!eps || eps.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>No endpoints detected yet.</div>';
    return;
  }
  list.innerHTML = eps.map((ep, i) => \`
    <div class="endpoint-item \${selectedEndpoint === i ? 'active' : ''}" onclick="selectEndpoint(\${i})">
      <span class="method-badge m-\${ep.method}">\${ep.method}</span>
      <span class="endpoint-path" title="\${escHtml(ep.path)}">\${escHtml(ep.path)}</span>
      \${ep.isDynamic ? '<span class="badge-dyn">:id</span>' : ''}
      \${ep.pagination ? '<span class="badge-pag">📄</span>' : ''}
    </div>
  \`).join('');
}

function selectEndpoint(idx) {
  selectedEndpoint = idx;
  renderEndpoints(endpoints);
  const ep = endpoints[idx];
  if (!ep) return;

  // Pre-fill test input
  document.getElementById('test-path').value = ep.path.replace(/:(\w+)/g, '1');
  document.getElementById('test-method').value = ep.method;

  const detail = document.getElementById('endpoint-detail');
  const examplesHtml = ep.examples.map(ex => \`
    <div style="margin-top:4px;padding:6px;background:var(--bg);border-radius:4px;border:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:10px;color:\${statusColor(ex.status)};font-weight:700">\${ex.status}</span>
      <span style="font-size:10px;color:var(--fg2);margin-left:6px">\${ex.mimeType || 'application/json'}</span>
    </div>
  \`).join('');

  detail.innerHTML = \`
    <div class="endpoint-detail">
      <div class="detail-row">
        <span class="detail-key">Method</span>
        <span class="detail-val"><span class="method-badge m-\${ep.method}">\${ep.method}</span></span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Path</span>
        <span class="detail-val">\${escHtml(ep.path)}</span>
      </div>
      \${ep.isDynamic ? \`<div class="detail-row"><span class="detail-key">Params</span><span class="detail-val">\${ep.dynamicParams.join(', ')}</span></div>\` : ''}
      \${ep.pagination ? \`<div class="detail-row"><span class="detail-key">Pagination</span><span class="detail-val">\${ep.pagination.type} · \${ep.pagination.paramName}</span></div>\` : ''}
      <div class="detail-row">
        <span class="detail-key">Responses</span>
        <div style="flex:1">\${examplesHtml}</div>
      </div>
    </div>
  \`;
}

function renderLogs(logs) {
  const el = document.getElementById('request-log');
  const count = document.getElementById('log-count');
  if (!logs.length) {
    el.innerHTML = '<div class="log-empty">Waiting for requests…</div>';
    count.textContent = '';
    return;
  }
  count.textContent = \`\${logs.length} recent\`;
  el.innerHTML = logs.map(entry => {
    const t = new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const sc = entry.status < 300 ? 's-2xx' : entry.status < 500 ? 's-4xx' : 's-5xx';
    return \`<div class="log-row">
      <span class="log-time">\${t}</span>
      <span class="log-method m-\${entry.method}" style="font-family:var(--mono);font-size:10px;font-weight:700;color:inherit">\${entry.method}</span>
      <span class="log-path">\${escHtml(entry.path)}</span>
      <span class="log-status \${sc}">\${entry.status}</span>
      <span class="log-dur">\${entry.durationMs}ms</span>
    </div>\`;
  }).join('');
}

// ─── Behavior Controls ────────────────────────────────────────────────────

function onLatencyChange() {
  const v = parseInt(document.getElementById('latency-slider').value);
  document.getElementById('latency-val').textContent = v >= 1000 ? (v/1000).toFixed(1)+'s' : v+'ms';
}
function onErrChange(name) {
  const v = parseInt(document.getElementById(name+'-slider').value);
  document.getElementById(name+'-val').textContent = v+'%';
}
function setLatency(ms) {
  document.getElementById('latency-slider').value = ms;
  onLatencyChange();
  applyBehavior();
}
function onChaosToggle() {
  const enabled = document.getElementById('chaos-toggle').checked;
  vscode.postMessage({ command: 'setChaos', chaosEnabled: enabled });
}
function applyBehavior() {
  const latencyMs = parseInt(document.getElementById('latency-slider').value);
  const e500 = parseInt(document.getElementById('err500-slider').value) / 100;
  const e429 = parseInt(document.getElementById('err429-slider').value) / 100;
  const e404 = parseInt(document.getElementById('err404-slider').value) / 100;
  vscode.postMessage({
    command: 'setBehavior',
    latencyMs,
    errorRates: { 500: e500, 429: e429, 404: e404 },
  });
}
function applyPreset(name) {
  const presets = {
    clean: { latency: 0, e500: 0, e429: 0, e404: 0 },
    slow:  { latency: 2000, e500: 0, e429: 0, e404: 0 },
    flaky: { latency: 500, e500: 0.2, e429: 0.1, e404: 0 },
    down:  { latency: 0, e500: 0.8, e429: 0, e404: 0.2 },
  };
  const p = presets[name];
  if (!p) return;
  setLatency(p.latency);
  document.getElementById('err500-slider').value = p.e500*100;
  document.getElementById('err429-slider').value = p.e429*100;
  document.getElementById('err404-slider').value = p.e404*100;
  onErrChange('err500'); onErrChange('err429'); onErrChange('err404');
  applyBehavior();
}

// ─── Test endpoint ────────────────────────────────────────────────────────

function testEndpoint() {
  const method = document.getElementById('test-method').value;
  const path = document.getElementById('test-path').value.trim();
  if (!path) return;
  const resultEl = document.getElementById('test-result');
  resultEl.style.display = 'block';
  resultEl.textContent = 'Sending...';
  vscode.postMessage({ command: 'testEndpoint', method, path });
}

// ─── Exasol AI Functions ───────────────────────────────────────────────────

function checkExasolStatus() {
  vscode.postMessage({ command: 'exasolStatus' });
}
setTimeout(checkExasolStatus, 1000);

function askExasol(query) {
  const q = query || document.getElementById('ai-input').value.trim();
  if (!q) return;
  document.getElementById('ai-input').value = q;
  document.getElementById('ai-result-area').style.display = 'block';
  document.getElementById('ai-loading').style.display = 'block';
  document.getElementById('ai-output').innerHTML = '';
  vscode.postMessage({ command: 'aiQuery', question: q });
}

function syncExasol() {
  document.getElementById('sync-msg').textContent = 'Syncing...';
  vscode.postMessage({ command: 'syncExasol' });
}

// ─── Utils ────────────────────────────────────────────────────────────────

function copyUrl() {
  if (currentStatus?.url) vscode.postMessage({ command: 'copyUrl', path: currentStatus.url });
}
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function statusColor(s) {
  if (s < 300) return 'var(--success)';
  if (s < 500) return 'var(--warn)';
  return 'var(--danger)';
}

// ─── Message handler ──────────────────────────────────────────────────────

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'update') {
    renderAll(msg.project, msg.mockStatus, msg.logs);
  }
  if (msg.type === 'endpoints') {
    renderEndpoints(msg.endpoints);
  }
  if (msg.type === 'testResult') {
    const el = document.getElementById('test-result');
    el.style.display = 'block';
    if (msg.error) {
      el.textContent = '⚠ ' + msg.error;
      el.style.color = 'var(--danger)';
    } else {
      el.style.color = msg.ok ? 'var(--success)' : 'var(--warn)';
      let body = msg.body;
      try { body = JSON.stringify(JSON.parse(msg.body), null, 2); } catch {}
      el.textContent = 'HTTP ' + msg.status + '\\n\\n' + body;
    }
  }
});
</script>
</body>
</html>`;
  }

  pushEndpoints(endpoints: unknown[]): void {
    if (this.disposed) return;
    this.panel.webview.postMessage({ type: "endpoints", endpoints });
  }
}
