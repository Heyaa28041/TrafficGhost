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
    --bg: var(--vscode-sideBar-background, #0a0a14);
    --fg: var(--vscode-foreground, #e8e8f2);
    --fg-dim: var(--vscode-descriptionForeground, #8b8ba3);
    --accent: #8b7bff;
    --accent-bright: #a695ff;
    --accent2: #00e6b8;
    --danger: #ff6b6b;
    --warn: #ffb648;
    --success: #3ddc84;
    --card-bg: var(--vscode-editor-background, #12121f);
    --card-bg-2: #171728;
    --border: rgba(139,123,255,0.16);
    --border-soft: rgba(255,255,255,0.06);
    --btn-radius: 10px;
    --font: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
    --mono: 'Cascadia Code', 'SF Mono', Consolas, monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scrollbar-color: rgba(139,123,255,0.35) transparent; }
  body {
    background:
      radial-gradient(circle at 15% 0%, rgba(139,123,255,0.10), transparent 40%),
      radial-gradient(circle at 90% 20%, rgba(0,230,184,0.06), transparent 35%),
      var(--bg);
    color: var(--fg);
    font-family: var(--font);
    font-size: 13px;
    padding: 14px;
    min-height: 100vh;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: rgba(139,123,255,0.3); border-radius: 4px; }

  /* ── Header ─────────────────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 2px 16px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border-soft);
  }
  .logo-badge {
    width: 34px; height: 34px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg, rgba(139,123,255,0.22), rgba(0,230,184,0.12));
    border: 1px solid var(--border);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.02), 0 4px 14px rgba(139,123,255,0.18);
    flex-shrink: 0;
    font-size: 17px;
  }
  .header-text { min-width: 0; }
  .brand {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.2px;
    background: linear-gradient(135deg, var(--accent-bright), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
  }
  .tagline {
    font-size: 10.5px;
    color: var(--fg-dim);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Step tracker ───────────────────────────────────── */
  .steps {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding: 0 2px;
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    position: relative;
    flex: 1;
  }
  .step-circle {
    width: 22px; height: 22px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--card-bg-2);
    border: 1.5px solid var(--border-soft);
    color: var(--fg-dim);
    font-size: 10px;
    font-weight: 700;
    transition: all 0.35s cubic-bezier(.4,0,.2,1);
    z-index: 1;
  }
  .step-label {
    font-size: 9px;
    color: var(--fg-dim);
    letter-spacing: 0.3px;
    text-transform: uppercase;
    transition: color 0.3s ease;
  }
  .step-line {
    position: absolute;
    top: 11px; left: 50%;
    width: 100%; height: 1.5px;
    background: var(--border-soft);
    z-index: 0;
    transition: background 0.4s ease;
  }
  .step:last-child .step-line { display: none; }
  .step.done .step-circle {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border-color: transparent;
    color: #0a0a14;
    box-shadow: 0 0 10px rgba(139,123,255,0.5);
  }
  .step.done .step-line { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
  .step.done .step-label { color: var(--accent-bright); }
  .step.active .step-circle {
    border-color: var(--accent);
    color: var(--accent-bright);
    box-shadow: 0 0 0 3px rgba(139,123,255,0.15);
    animation: stepPulse 1.6s ease-in-out infinite;
  }
  .step.active .step-label { color: var(--fg); font-weight: 600; }
  @keyframes stepPulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(139,123,255,0.15); }
    50% { box-shadow: 0 0 0 6px rgba(139,123,255,0.06); }
  }

  /* ── Buttons ────────────────────────────────────────── */
  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 11px 16px;
    border: none;
    border-radius: var(--btn-radius);
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
    font-family: var(--font);
    letter-spacing: 0.3px;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    margin-bottom: 9px;
    position: relative;
  }
  .btn-primary svg { flex-shrink: 0; }
  .btn-capture {
    background: linear-gradient(135deg, #3d2fa0, #6656e0);
    color: #fff;
    border: 1px solid rgba(139,123,255,0.4);
  }
  .btn-capture:hover:not(:disabled) {
    filter: brightness(1.12);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(90,77,212,0.38);
  }
  .btn-start {
    background: linear-gradient(135deg, #00895c, #00d191);
    color: #052b1f;
    border: 1px solid rgba(0,230,184,0.4);
  }
  .btn-start:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0,200,140,0.35);
  }
  .btn-stop {
    background: linear-gradient(135deg, #6b1a1a, #c23a3a);
    color: #fff;
    border: 1px solid rgba(255,107,107,0.4);
  }
  .btn-stop:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(200,60,60,0.35);
  }
  .btn-dashboard {
    background: rgba(139,123,255,0.06);
    color: var(--accent-bright);
    border: 1px solid var(--border);
    font-size: 12px;
    padding: 9px 16px;
  }
  .btn-dashboard:hover:not(:disabled) {
    background: rgba(139,123,255,0.14);
    border-color: var(--accent);
  }
  .btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.99); }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  /* ── Status card ────────────────────────────────────── */
  .status-card {
    background: linear-gradient(180deg, var(--card-bg-2), var(--card-bg));
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 13px;
    margin-bottom: 12px;
    animation: fadeSlideIn 0.35s ease both;
  }
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .status-row {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .dot-wrap { position: relative; width: 10px; height: 10px; flex-shrink: 0; }
  .dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    position: absolute; top: 0; left: 0;
  }
  .dot-ring {
    position: absolute; inset: -4px;
    border-radius: 50%;
    border: 1px solid transparent;
  }
  .dot-idle { background: #4a4a5e; }
  .dot-capturing { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
  .dot-capturing + .dot-ring, .dot-loading + .dot-ring { border-color: rgba(255,182,72,0.4); animation: ringPulse 1.1s ease-out infinite; }
  .dot-captured { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  .dot-running { background: var(--success); box-shadow: 0 0 8px var(--success); }
  .dot-running + .dot-ring { border-color: rgba(61,220,132,0.4); animation: ringPulse 1.8s ease-out infinite; }
  .dot-error { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
  .dot-loading { background: #9a9ab5; }
  @keyframes ringPulse {
    0% { transform: scale(0.6); opacity: 0.9; }
    100% { transform: scale(1.6); opacity: 0; }
  }

  .status-label { font-size: 12.5px; font-weight: 600; }
  .status-url {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--accent2);
    font-family: var(--mono);
    background: rgba(0,230,184,0.07);
    border: 1px solid rgba(0,230,184,0.18);
    padding: 5px 9px;
    border-radius: 7px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 8px;
    transition: background 0.15s ease;
  }
  .status-url:hover { background: rgba(0,230,184,0.13); }
  .status-url svg { flex-shrink: 0; opacity: 0.8; }

  .toast {
    font-size: 10.5px;
    color: var(--accent2);
    margin-top: 6px;
    opacity: 0;
    height: 0;
    overflow: hidden;
    transition: opacity 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .toast.show { opacity: 1; height: auto; animation: toastPop 1.6s ease forwards; }
  @keyframes toastPop {
    0% { opacity: 0; transform: translateY(-2px); }
    12% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ── Stats grid ─────────────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
    margin-bottom: 12px;
    animation: fadeSlideIn 0.4s ease both;
  }
  .stat-item {
    background: var(--card-bg-2);
    border: 1px solid var(--border-soft);
    border-radius: 8px;
    padding: 9px 8px;
    text-align: center;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .stat-item:hover { border-color: var(--border); transform: translateY(-1px); }
  .stat-value {
    font-size: 19px;
    font-weight: 700;
    color: var(--accent-bright);
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .stat-label {
    font-size: 9.5px;
    color: var(--fg-dim);
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .stat-dyn .stat-value { color: var(--accent2); }
  .stat-pag .stat-value { color: var(--warn); }

  /* ── Message / empty state ──────────────────────────── */
  .message {
    font-size: 11px;
    color: var(--fg-dim);
    text-align: center;
    padding: 4px 4px 6px;
    line-height: 1.5;
  }
  .message.error { color: var(--danger); }
  .message.success { color: var(--success); }

  .empty-state {
    text-align: center;
    padding: 22px 10px 6px;
    color: var(--fg-dim);
  }
  .empty-icon {
    width: 40px; height: 40px;
    margin: 0 auto 10px;
    border-radius: 12px;
    background: rgba(139,123,255,0.08);
    border: 1px dashed var(--border);
    display: flex; align-items: center; justify-content: center;
    opacity: 0.85;
  }
  .empty-state .hint { font-size: 11px; line-height: 1.6; }
  .empty-state .hint strong { color: var(--accent-bright); font-weight: 600; }

  .divider {
    border: none;
    border-top: 1px solid var(--border-soft);
    margin: 12px 0;
  }

  .spinner {
    display: inline-block;
    width: 13px; height: 13px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .source-chip {
    display: inline-flex;
    align-items: center;
    font-size: 9.5px;
    background: rgba(139,123,255,0.12);
    color: var(--accent-bright);
    border: 1px solid rgba(139,123,255,0.25);
    border-radius: 100px;
    padding: 1px 8px;
    margin-left: 6px;
    font-family: var(--mono);
  }
</style>
</head>
<body>
<div class="header">
  <div class="logo-badge">👻</div>
  <div class="header-text">
    <div class="brand">TrafficGhost</div>
    <div class="tagline">Reconstruct your API. No backend needed.</div>
  </div>
</div>

<div id="app"></div>

<script>
const vscode = acquireVsCodeApi();

const ICONS = {
  capture: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a7 7 0 0 1 14 0"/><path d="M8.5 12.5a3.5 3.5 0 0 1 7 0"/><circle cx="12" cy="12.5" r="1.2" fill="currentColor" stroke="none"/><path d="M12 19v2"/></svg>',
  rocket: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 19 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  stop: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  dashboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h5l2-8 4 16 2-8h5"/></svg>',
  link: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  ghostSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2a7 7 0 0 0-7 7v11l2.5-2 2.5 2 2-2 2 2 2.5-2 2.5 2V9a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="10" r="1" fill="currentColor" stroke="none"/></svg>'
};

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

  // Step tracker progress: 1 capture, 2 mock, 3 dashboard
  const step1Done = hasTraffic || hasMock;
  const step2Done = hasMock;
  const step1Active = !step1Done && (isCapturing);
  const step2Active = step1Done && !step2Done && !isCapturing;
  const step3Active = step2Done;

  let dotClass = 'dot-idle';
  let statusText = 'Ready to capture';
  if (isCapturing) { dotClass = 'dot-capturing'; statusText = 'Capturing traffic…'; }
  else if (isGenerating) { dotClass = 'dot-loading'; statusText = 'Generating mock…'; }
  else if (isStopping) { dotClass = 'dot-loading'; statusText = 'Stopping…'; }
  else if (hasMock) { dotClass = 'dot-running'; statusText = 'Mock server running'; }
  else if (isCaptured || hasTraffic) { dotClass = 'dot-captured'; statusText = 'Traffic captured'; }
  else if (isError) { dotClass = 'dot-error'; statusText = 'Something went wrong'; }

  const sourceHtml = project?.source
    ? '<span class="source-chip">' + escHtml(project.source) + '</span>'
    : '';

  const stepsHtml = \`
    <div class="steps">
      <div class="step \${step1Done ? 'done' : step1Active ? 'active' : ''}">
        <div class="step-line"></div>
        <div class="step-circle">\${step1Done ? ICONS.check : '1'}</div>
        <div class="step-label">Capture</div>
      </div>
      <div class="step \${step2Done ? 'done' : step2Active ? 'active' : ''}">
        <div class="step-line"></div>
        <div class="step-circle">\${step2Done ? ICONS.check : '2'}</div>
        <div class="step-label">Mock</div>
      </div>
      <div class="step \${step3Active ? 'active' : ''}">
        <div class="step-circle">3</div>
        <div class="step-label">Dashboard</div>
      </div>
    </div>
  \`;

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
        <div class="stat-label">Dynamic</div>
      </div>
      <div class="stat-item stat-pag">
        <div class="stat-value">\${project.paginatedEndpointCount || '—'}</div>
        <div class="stat-label">Paginated</div>
      </div>
    </div>
  \` : '';

  const mockUrlHtml = hasMock && project?.mockUrl ? \`
    <div class="status-url" onclick="copyUrl('\${escHtml(project.mockUrl)}')" title="Click to copy">
      \${ICONS.link} \${escHtml(project.mockUrl)}
    </div>
    <div class="toast" id="copy-toast">\${ICONS.check} Copied to clipboard</div>
  \` : '';

  const msgClass = isError ? 'error' : (hasMock || isCaptured) ? 'success' : '';
  const msgText = statusMessage || (isError ? 'Something went wrong. Check VS Code output.' : '');

  const captureLabel = isCapturing
    ? '<span class="spinner"></span> Capturing…'
    : ICONS.capture + ' Capture Traffic';

  const startLabel = isGenerating
    ? '<span class="spinner"></span> Starting…'
    : ICONS.rocket + ' Start Mock';

  const stopLabel = isStopping
    ? '<span class="spinner"></span> Stopping…'
    : ICONS.stop + ' Stop Server';

  const emptyHtml = (!hasTraffic && state === 'idle') ? \`
    <div class="empty-state">
      <div class="empty-icon">\${ICONS.ghostSmall}</div>
      <div class="hint">Click <strong>Capture Traffic</strong> to import a HAR file or start the live proxy.</div>
    </div>
  \` : '';

  app.innerHTML = \`
    \${stepsHtml}

    <div class="status-card">
      <div class="status-row">
        <div class="dot-wrap"><span class="dot \${dotClass}"></span><span class="dot-ring"></span></div>
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
        \${ICONS.dashboard} Open Dashboard
      </button>
    \` : ''}

    \${msgText ? \`<div class="message \${msgClass}">\${escHtml(msgText)}</div>\` : ''}

    \${emptyHtml}
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
  const toast = document.getElementById('copy-toast');
  if (toast) {
    toast.classList.remove('show');
    void toast.offsetWidth; // restart animation
    toast.classList.add('show');
  }
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
