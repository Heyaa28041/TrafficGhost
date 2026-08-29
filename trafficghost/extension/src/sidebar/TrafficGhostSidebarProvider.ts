// TrafficGhost — Sidebar WebviewView Provider
// Renders the two-button control panel in the VS Code activity bar sidebar.

import * as vscode from "vscode";
import { EngineClient, BehaviorConfig, ProjectState } from "../services/EngineClient";

type AppState =
  | "idle"
  | "capturing"
  | "captured"
  | "generating"
  | "running"
  | "stopping"
  | "error";

export class TrafficGhostSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "trafficghost.sidebar";
  private view?: vscode.WebviewView;
  private state: AppState = "idle";
  private statusMessage = "";
  private project: ProjectState | null = null;
  private pollInterval: NodeJS.Timeout | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly client: EngineClient,
    private readonly onCapture: () => Promise<void>,
    private readonly onStartMock: () => Promise<void>,
    private readonly onStop: () => Promise<void>,
    private readonly onOpenDashboard: () => void
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (msg: { command: string }) => {
      switch (msg.command) {
        case "capture":
          await this.onCapture();
          break;
        case "startMock":
          await this.onStartMock();
          break;
        case "stop":
          await this.onStop();
          break;
        case "openDashboard":
          this.onOpenDashboard();
          break;
      }
    });

    // Start polling for live status
    this.startPolling();
    webviewView.onDidDispose(() => this.stopPolling());
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.startPolling();
        this.refreshFromEngine();
      } else {
        this.stopPolling();
      }
    });

    // Initial refresh
    this.refreshFromEngine();
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollInterval = setInterval(() => this.refreshFromEngine(), 3000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  private async refreshFromEngine(): Promise<void> {
    try {
      const project = await this.client.getProject();
      this.project = project;
      // Sync running state
      if (project.mockRunning && this.state !== "running") {
        this.state = "running";
      } else if (!project.mockRunning && this.state === "running") {
        this.state = "captured";
      }
      this.updateView();
    } catch {
      // Engine not yet ready — stay in current state
    }
  }

  setState(state: AppState, msg = ""): void {
    this.state = state;
    this.statusMessage = msg;
    this.updateView();
  }

  setProject(project: ProjectState): void {
    this.project = project;
  }

  private updateView(): void {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: "update",
      state: this.state,
      statusMessage: this.statusMessage,
      project: this.project,
    });
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>TrafficGhost</title>
<style>
  :root {
    --bg: var(--vscode-sideBar-background, #0d0d1a);
    --fg: var(--vscode-foreground, #e0e0e0);
    --accent: #7c6af7;
    --accent2: #00d4aa;
    --danger: #f07070;
    --warn: #f0b040;
    --success: #40c078;
    --card-bg: var(--vscode-editor-background, #131326);
    --border: rgba(124,106,247,0.2);
    --btn-radius: 8px;
    --font: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font);
    font-size: 13px;
    padding: 12px;
    min-height: 100vh;
    overflow-x: hidden;
  }
  .header {
    text-align: center;
    padding: 16px 0 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .logo { font-size: 28px; line-height: 1; margin-bottom: 6px; }
  .brand {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .tagline {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    margin-top: 3px;
  }

  /* Primary buttons */
  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: var(--btn-radius);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font);
    letter-spacing: 0.3px;
    transition: all 0.15s ease;
    margin-bottom: 10px;
    position: relative;
    overflow: hidden;
  }
  .btn-capture {
    background: linear-gradient(135deg, #3d2fa0, #5a4dd4);
    color: #fff;
    border: 1px solid rgba(124,106,247,0.4);
  }
  .btn-capture:hover:not(:disabled) {
    background: linear-gradient(135deg, #4a3abd, #6a5de8);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(90,77,212,0.4);
  }
  .btn-start {
    background: linear-gradient(135deg, #006644, #00a86b);
    color: #fff;
    border: 1px solid rgba(0,212,170,0.4);
  }
  .btn-start:hover:not(:disabled) {
    background: linear-gradient(135deg, #007a52, #00c27e);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0,180,100,0.4);
  }
  .btn-stop {
    background: linear-gradient(135deg, #6b1a1a, #b03030);
    color: #fff;
    border: 1px solid rgba(240,112,112,0.4);
  }
  .btn-stop:hover:not(:disabled) {
    background: linear-gradient(135deg, #7f1f1f, #cc3c3c);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(200,60,60,0.4);
  }
  .btn-dashboard {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--border);
    font-size: 12px;
    padding: 8px 16px;
  }
  .btn-dashboard:hover:not(:disabled) {
    background: rgba(124,106,247,0.1);
    border-color: var(--accent);
  }
  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none !important;
  }
  .btn-icon { font-size: 16px; }

  /* Status card */
  .status-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: var(--btn-radius);
    padding: 12px;
    margin-bottom: 10px;
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .status-row:last-child { margin-bottom: 0; }
  .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .dot-idle { background: #555; }
  .dot-capturing { background: var(--warn); box-shadow: 0 0 6px var(--warn); animation: pulse 1s infinite; }
  .dot-captured { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
  .dot-running { background: var(--success); box-shadow: 0 0 6px var(--success); animation: pulse 2s infinite; }
  .dot-error { background: var(--danger); box-shadow: 0 0 6px var(--danger); }
  .dot-loading { background: #888; animation: pulse 0.8s infinite; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .status-label { font-size: 12px; font-weight: 500; }
  .status-url {
    font-size: 11px;
    color: var(--accent2);
    font-family: monospace;
    background: rgba(0,212,170,0.08);
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .status-url:hover { background: rgba(0,212,170,0.15); }

  /* Stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 10px;
  }
  .stat-item {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
  }
  .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1.2;
  }
  .stat-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground, #888);
    margin-top: 2px;
  }
  .stat-dyn .stat-value { color: var(--accent2); }
  .stat-pag .stat-value { color: var(--warn); }

  /* Message area */
  .message {
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    text-align: center;
    padding: 4px 0 8px;
    min-height: 20px;
  }
  .message.error { color: var(--danger); }
  .message.success { color: var(--success); }

  /* Section label */
  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--vscode-descriptionForeground, #666);
    margin: 12px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }

  /* Spinner */
  .spinner {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Source chip */
  .source-chip {
    display: inline-block;
    font-size: 10px;
    background: rgba(124,106,247,0.15);
    color: var(--accent);
    border: 1px solid rgba(124,106,247,0.3);
    border-radius: 100px;
    padding: 2px 8px;
    margin-left: 6px;
    font-family: monospace;
    vertical-align: middle;
  }

  .divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 12px 0;
  }
</style>
</head>
<body>
<div class="header">
  <div class="logo">👻</div>
  <div class="brand">TrafficGhost</div>
  <div class="tagline">Reconstruct your API. No backend needed.</div>
</div>

<div id="app"></div>

<script>
const vscode = acquireVsCodeApi();

let appState = {
  state: 'idle',
  statusMessage: '',
  project: null,
};

function render(s) {
  const { state, statusMessage, project } = s;
  const app = document.getElementById('app');

  const isCapturing = state === 'capturing';
  const isGenerating = state === 'generating';
  const isStopping = state === 'stopping';
  const isRunning = state === 'running';
  const isCaptured = state === 'captured' || (project && project.trafficCount > 0 && !isRunning);
  const isError = state === 'error';
  const isBusy = isCapturing || isGenerating || isStopping;

  const hasTraffic = project && project.trafficCount > 0;
  const hasMock = isRunning || (project && project.mockRunning);

  // Status dot
  let dotClass = 'dot-idle';
  let statusText = 'Ready';
  if (isCapturing) { dotClass = 'dot-capturing'; statusText = 'Capturing traffic...'; }
  else if (isGenerating) { dotClass = 'dot-loading'; statusText = 'Generating mock...'; }
  else if (isStopping) { dotClass = 'dot-loading'; statusText = 'Stopping...'; }
  else if (hasMock) { dotClass = 'dot-running'; statusText = 'Mock running'; }
  else if (isCaptured || hasTraffic) { dotClass = 'dot-captured'; statusText = 'Traffic captured'; }
  else if (isError) { dotClass = 'dot-error'; statusText = 'Error'; }

  const sourceHtml = project?.source
    ? '<span class="source-chip">' + escHtml(project.source) + '</span>'
    : '';

  const statsHtml = hasTraffic ? \`
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">\${project.trafficCount}</div>
        <div class="stat-label">Requests</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">\${project.endpointCount || '—'}</div>
        <div class="stat-label">APIs</div>
      </div>
      <div class="stat-item stat-dyn">
        <div class="stat-value">\${project.dynamicRouteCount || '—'}</div>
        <div class="stat-label">Dynamic Routes</div>
      </div>
      <div class="stat-item stat-pag">
        <div class="stat-value">\${project.paginatedEndpointCount || '—'}</div>
        <div class="stat-label">Pagination</div>
      </div>
    </div>
  \` : '';

  const mockUrlHtml = hasMock && project?.mockUrl ? \`
    <div class="status-row" style="margin-top:6px">
      <span class="status-url" onclick="copyUrl('\${escHtml(project.mockUrl)}')" title="Click to copy">
        \${escHtml(project.mockUrl)}
      </span>
    </div>
  \` : '';

  const msgClass = isError ? 'error' : (hasMock || isCaptured) ? 'success' : '';
  const msgText = statusMessage || (isError ? 'Something went wrong. Check VS Code output.' : '');

  const captureLabel = isCapturing
    ? '<span class="spinner"></span> Capturing...'
    : '📡&nbsp; CAPTURE TRAFFIC';

  const startLabel = isGenerating
    ? '<span class="spinner"></span> Starting...'
    : '🚀&nbsp; START MOCK';

  const stopLabel = isStopping
    ? '<span class="spinner"></span> Stopping...'
    : '⏹&nbsp; STOP SERVER';

  app.innerHTML = \`
    <div class="status-card">
      <div class="status-row">
        <span class="dot \${dotClass}"></span>
        <span class="status-label">\${statusText}\${sourceHtml}</span>
      </div>
      \${mockUrlHtml}
    </div>

    \${statsHtml}

    <button class="btn-primary btn-capture"
      id="btn-capture"
      \${isBusy ? 'disabled' : ''}
      onclick="send('capture')">
      \${captureLabel}
    </button>

    <button class="btn-primary btn-start"
      id="btn-start"
      \${isBusy || (hasMock) ? 'disabled' : ''}
      onclick="send('startMock')">
      \${startLabel}
    </button>

    \${hasMock ? \`
      <button class="btn-primary btn-stop" \${isBusy ? 'disabled' : ''} onclick="send('stop')">
        \${stopLabel}
      </button>
    \` : ''}

    \${hasMock ? \`
      <hr class="divider">
      <button class="btn-primary btn-dashboard" onclick="send('openDashboard')">
        📊&nbsp; Open Dashboard
      </button>
    \` : ''}

    \${msgText ? \`<div class="message \${msgClass}">\${escHtml(msgText)}</div>\` : ''}

    \${!hasTraffic && state === 'idle' ? \`
      <div class="message" style="margin-top:8px;line-height:1.5">
        Click <strong>📡 CAPTURE TRAFFIC</strong> to import a HAR file or start the live proxy.
      </div>
    \` : ''}
  \`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function send(command) {
  vscode.postMessage({ command });
}

function copyUrl(url) {
  vscode.postMessage({ command: 'copyUrl', url });
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'update') {
    appState.state = msg.state;
    appState.statusMessage = msg.statusMessage || '';
    if (msg.project) appState.project = msg.project;
    render(appState);
  }
});

render(appState);
</script>
</body>
</html>`;
  }
}
