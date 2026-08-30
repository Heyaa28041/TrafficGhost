"use strict";
// TrafficGhost — Sidebar WebviewView Provider
// Renders the two-button control panel in the VS Code activity bar sidebar.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficGhostSidebarProvider = void 0;
class TrafficGhostSidebarProvider {
    constructor(extensionUri, client, onCapture, onStartMock, onStop, onOpenDashboard) {
        this.extensionUri = extensionUri;
        this.client = client;
        this.onCapture = onCapture;
        this.onStartMock = onStartMock;
        this.onStop = onStop;
        this.onOpenDashboard = onOpenDashboard;
        this.state = "idle";
        this.statusMessage = "";
        this.project = null;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtml();
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (msg) => {
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
            }
            else {
                this.stopPolling();
            }
        });
        // Initial refresh
        this.refreshFromEngine();
    }
    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => this.refreshFromEngine(), 3000);
    }
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }
    }
    async refreshFromEngine() {
        try {
            const project = await this.client.getProject();
            this.project = project;
            // Sync running state
            if (project.mockRunning && this.state !== "running") {
                this.state = "running";
            }
            else if (!project.mockRunning && this.state === "running") {
                this.state = "captured";
            }
            this.updateView();
        }
        catch {
            // Engine not yet ready — stay in current state
        }
    }
    setState(state, msg = "") {
        this.state = state;
        this.statusMessage = msg;
        this.updateView();
    }
    setProject(project) {
        this.project = project;
    }
    updateView() {
        if (!this.view)
            return;
        this.view.webview.postMessage({
            type: "update",
            state: this.state,
            statusMessage: this.statusMessage,
            project: this.project,
        });
    }
    getHtml() {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>TrafficGhost</title>
<style>
:root {
  --bg: var(--vscode-sideBar-background, #080814);
  --fg: var(--vscode-foreground, #e2e2f0);
  --accent: #8b5cf6;
  --accent2: #06d6a0;
  --accent3: #f59e0b;
  --danger: #ef4444;
  --warn: #f59e0b;
  --success: #10b981;
  --card-bg: rgba(15,15,35,0.8);
  --glass: rgba(255,255,255,0.04);
  --border: rgba(139,92,246,0.25);
  --border2: rgba(6,214,160,0.2);
  --btn-radius: 10px;
  --font: 'Inter', var(--vscode-font-family, 'Segoe UI'), system-ui, sans-serif;
  --mono: 'Cascadia Code', 'Consolas', monospace;
  --shadow-purple: 0 0 20px rgba(139,92,246,0.3);
  --shadow-teal: 0 0 20px rgba(6,214,160,0.3);
}
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 12.5px;
  padding: 0;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(6,214,160,0.06) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.container {
  position: relative;
  z-index: 1;
  padding: 14px 12px;
}

/* ── Header ── */
.header {
  text-align: center;
  padding: 18px 0 14px;
  margin-bottom: 14px;
  position: relative;
}

.ghost-wrap {
  position: relative;
  display: inline-block;
  margin-bottom: 10px;
}

.ghost-ring {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 60px; height: 60px;
  border-radius: 50%;
  border: 1px solid rgba(139,92,246,0.3);
  animation: ring-pulse 2.5s ease-in-out infinite;
}
.ghost-ring:nth-child(2) {
  width: 78px; height: 78px;
  border-color: rgba(139,92,246,0.15);
  animation-delay: 0.5s;
}

@keyframes ring-pulse {
  0% { transform: translate(-50%,-50%) scale(0.9); opacity: 0.8; }
  50% { transform: translate(-50%,-50%) scale(1.05); opacity: 0.3; }
  100% { transform: translate(-50%,-50%) scale(0.9); opacity: 0.8; }
}

.ghost-emoji {
  font-size: 36px;
  display: block;
  filter: drop-shadow(0 0 12px rgba(139,92,246,0.7));
  animation: float 3s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
}

.brand-text {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  background: linear-gradient(135deg, #a78bfa 0%, #06d6a0 60%, #a78bfa 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

.tagline {
  font-size: 10.5px;
  color: rgba(226,226,240,0.45);
  margin-top: 4px;
  letter-spacing: 0.2px;
}

/* ── Status orb ── */
.status-orb-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 10px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}

.status-orb-wrap::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent);
}

.orb {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
}

.orb::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  width: 20px; height: 20px;
  border-radius: 50%;
  animation: orb-ripple 2s ease-out infinite;
}

@keyframes orb-ripple {
  0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0.8; }
  100% { transform: translate(-50%,-50%) scale(2); opacity: 0; }
}

.orb-idle { background: #4b4b6a; box-shadow: 0 0 6px #4b4b6a; }
.orb-idle::after { border: 1px solid rgba(75,75,106,0.5); }

.orb-capturing {
  background: var(--warn);
  box-shadow: 0 0 10px var(--warn);
  animation: orb-blink 0.8s ease-in-out infinite;
}
.orb-capturing::after { border: 1px solid rgba(245,158,11,0.5); }

.orb-loading {
  background: rgba(255,255,255,0.4);
  animation: orb-blink 0.6s ease-in-out infinite;
}
.orb-loading::after { border: 1px solid rgba(255,255,255,0.3); }

.orb-captured { background: var(--accent); box-shadow: 0 0 10px rgba(139,92,246,0.8); }
.orb-captured::after { border: 1px solid rgba(139,92,246,0.4); }

.orb-running {
  background: var(--success);
  box-shadow: 0 0 12px rgba(16,185,129,0.9);
  animation: orb-blink 2s ease-in-out infinite;
}
.orb-running::after { border: 1px solid rgba(16,185,129,0.5); }

.orb-error { background: var(--danger); box-shadow: 0 0 10px rgba(239,68,68,0.8); }
.orb-error::after { border: 1px solid rgba(239,68,68,0.4); }

@keyframes orb-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.orb-label {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  letter-spacing: 0.1px;
}

.orb-badge {
  font-size: 9.5px;
  font-family: var(--mono);
  background: rgba(139,92,246,0.15);
  color: var(--accent);
  border: 1px solid rgba(139,92,246,0.3);
  border-radius: 100px;
  padding: 2px 7px;
}

/* ── Mock URL chip ── */
.mock-url-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  padding: 6px 10px;
  background: rgba(6,214,160,0.07);
  border: 1px solid rgba(6,214,160,0.25);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
}
.mock-url-chip::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--accent2), transparent);
  border-radius: 2px 0 0 2px;
}
.mock-url-chip:hover {
  background: rgba(6,214,160,0.13);
  border-color: rgba(6,214,160,0.45);
  box-shadow: var(--shadow-teal);
}
.mock-url-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent2);
  box-shadow: 0 0 6px var(--accent2);
  animation: orb-blink 2s ease-in-out infinite;
  flex-shrink: 0;
}
.mock-url-text {
  font-family: var(--mono);
  font-size: 10.5px;
  color: var(--accent2);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mock-url-copy {
  font-size: 9px;
  color: rgba(6,214,160,0.6);
  flex-shrink: 0;
}

/* ── Step wizard ── */
.wizard {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 12px;
  padding: 0 4px;
}
.wizard-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  position: relative;
}
.wizard-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 10px;
  left: calc(50% + 12px);
  width: calc(100% - 24px);
  height: 1px;
  background: var(--border);
  transition: background 0.3s;
}
.wizard-step.done:not(:last-child)::after {
  background: linear-gradient(90deg, var(--accent), var(--accent2));
}
.wizard-icon {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 0.3s;
  position: relative;
  z-index: 1;
}
.wizard-step.active .wizard-icon {
  background: rgba(139,92,246,0.2);
  border-color: var(--accent);
  box-shadow: 0 0 10px rgba(139,92,246,0.4);
}
.wizard-step.done .wizard-icon {
  background: rgba(16,185,129,0.2);
  border-color: var(--success);
  box-shadow: 0 0 8px rgba(16,185,129,0.3);
}
.wizard-label {
  font-size: 9px;
  color: rgba(226,226,240,0.35);
  text-align: center;
  line-height: 1.2;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.wizard-step.active .wizard-label { color: var(--accent); }
.wizard-step.done .wizard-label { color: var(--success); }

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.stat-card {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 10px 8px;
  text-align: center;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(4px);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.5;
}
.stat-card:hover {
  border-color: rgba(139,92,246,0.4);
  box-shadow: 0 0 12px rgba(139,92,246,0.15);
}
.stat-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--accent);
  line-height: 1.1;
  letter-spacing: -0.5px;
}
.stat-lbl {
  font-size: 9.5px;
  color: rgba(226,226,240,0.45);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.stat-card.teal::before { background: linear-gradient(90deg, transparent, var(--accent2), transparent); }
.stat-card.teal .stat-val { color: var(--accent2); }
.stat-card.teal:hover { border-color: rgba(6,214,160,0.4); box-shadow: 0 0 12px rgba(6,214,160,0.15); }
.stat-card.amber::before { background: linear-gradient(90deg, transparent, var(--accent3), transparent); }
.stat-card.amber .stat-val { color: var(--accent3); }
.stat-card.amber:hover { border-color: rgba(245,158,11,0.4); box-shadow: 0 0 12px rgba(245,158,11,0.15); }

/* ── Buttons ── */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 11px 16px;
  border: none;
  border-radius: var(--btn-radius);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 700;
  font-family: var(--font);
  letter-spacing: 0.4px;
  transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
  margin-bottom: 8px;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
}

.btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
  transition: left 0.4s ease;
}
.btn:hover:not(:disabled)::after { left: 100%; }

.btn-capture {
  background: linear-gradient(135deg, #3b1f8c 0%, #6d28d9 50%, #7c3aed 100%);
  color: #fff;
  border: 1px solid rgba(139,92,246,0.4);
  box-shadow: 0 2px 12px rgba(109,40,217,0.3);
}
.btn-capture:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(109,40,217,0.5);
  border-color: rgba(167,139,250,0.6);
}

.btn-start {
  background: linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%);
  color: #fff;
  border: 1px solid rgba(6,214,160,0.3);
  box-shadow: 0 2px 12px rgba(5,150,105,0.3);
}
.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(5,150,105,0.5);
  border-color: rgba(6,214,160,0.6);
}

.btn-stop {
  background: linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #dc2626 100%);
  color: #fff;
  border: 1px solid rgba(239,68,68,0.3);
  box-shadow: 0 2px 12px rgba(153,27,27,0.3);
}
.btn-stop:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(153,27,27,0.5);
  border-color: rgba(239,68,68,0.6);
}

.btn-dashboard {
  background: var(--glass);
  color: var(--accent);
  border: 1px solid var(--border);
  font-size: 11.5px;
  padding: 9px 16px;
  text-transform: none;
  letter-spacing: 0.2px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}
.btn-dashboard:hover:not(:disabled) {
  background: rgba(139,92,246,0.12);
  border-color: rgba(139,92,246,0.5);
  box-shadow: var(--shadow-purple);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* ── Spinner ── */
.spinner {
  display: inline-block;
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  vertical-align: middle;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Message ── */
.msg {
  font-size: 11px;
  text-align: center;
  padding: 6px 8px;
  border-radius: 6px;
  margin-top: 4px;
  line-height: 1.5;
}
.msg-idle {
  color: rgba(226,226,240,0.4);
}
.msg-error {
  color: var(--danger);
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
}
.msg-success {
  color: var(--success);
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16,185,129,0.2);
}

.divider {
  border: none;
  border-top: 1px solid rgba(139,92,246,0.15);
  margin: 10px 0;
}

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }

/* ── idle onboard ── */
.onboard {
  text-align: center;
  padding: 16px 8px 4px;
  color: rgba(226,226,240,0.38);
  font-size: 11px;
  line-height: 1.7;
}
.onboard strong {
  color: rgba(167,139,250,0.8);
  font-weight: 600;
}
</style>
</head>
<body>
<div class="container">

<div class="header">
  <div class="ghost-wrap">
    <div class="ghost-ring"></div>
    <div class="ghost-ring"></div>
    <span class="ghost-emoji">👻</span>
  </div>
  <div class="brand-text">TrafficGhost</div>
  <div class="tagline">Reconstruct your API. No backend needed.</div>
</div>

<div id="wizard" class="wizard"></div>

<div id="status-orb" class="status-orb-wrap">
  <div class="orb orb-idle" id="orb"></div>
  <span class="orb-label" id="orb-label">Ready</span>
  <span class="orb-badge" id="orb-badge" style="display:none"></span>
</div>

<div id="mock-url-wrap" style="display:none">
  <div class="mock-url-chip" onclick="send('copyUrl')" id="mock-url-chip">
    <span class="mock-url-dot"></span>
    <span class="mock-url-text" id="mock-url-text"></span>
    <span class="mock-url-copy">⎘ copy</span>
  </div>
</div>

<div id="stats" style="display:none" class="stats-grid"></div>

<div id="btns"></div>

<div id="msg"></div>

</div>

<script>
const vscode = acquireVsCodeApi();

let appState = {
  state: 'idle',
  statusMessage: '',
  project: null,
};

let _mockUrl = '';

function render(s) {
  const { state, statusMessage, project } = s;

  const isCapturing  = state === 'capturing';
  const isGenerating = state === 'generating';
  const isStopping   = state === 'stopping';
  const isRunning    = state === 'running';
  const isCaptured   = state === 'captured' || (project && project.trafficCount > 0 && !isRunning);
  const isError      = state === 'error';
  const isBusy       = isCapturing || isGenerating || isStopping;
  const hasTraffic   = project && project.trafficCount > 0;
  const hasMock      = isRunning || (project && project.mockRunning);

  /* wizard */
  let w0 = 'idle', w1 = 'idle', w2 = 'idle';
  if (isBusy && isCapturing) { w0 = 'active'; }
  else if (hasTraffic && !hasMock) { w0 = 'done'; w1 = isGenerating ? 'active' : 'idle'; }
  else if (hasTraffic && isGenerating) { w0 = 'done'; w1 = 'active'; }
  else if (hasMock) { w0 = 'done'; w1 = 'done'; w2 = 'active'; }
  else if (!hasTraffic) { w0 = 'active'; }
  document.getElementById('wizard').innerHTML = wizardHtml(w0, w1, w2);

  /* orb */
  let orbClass = 'orb-idle', orbLabel = 'Ready', orbBadge = '';
  if (isCapturing)       { orbClass = 'orb-capturing'; orbLabel = 'Capturing traffic…'; }
  else if (isGenerating) { orbClass = 'orb-loading';   orbLabel = 'Generating mock…'; }
  else if (isStopping)   { orbClass = 'orb-loading';   orbLabel = 'Stopping server…'; }
  else if (hasMock)      { orbClass = 'orb-running';   orbLabel = 'Mock server running'; orbBadge = 'LIVE'; }
  else if (isCaptured || hasTraffic) { orbClass = 'orb-captured'; orbLabel = 'Traffic captured'; }
  else if (isError)      { orbClass = 'orb-error';     orbLabel = 'Error'; }

  const orb = document.getElementById('orb');
  orb.className = 'orb ' + orbClass;
  document.getElementById('orb-label').textContent = orbLabel;
  const badge = document.getElementById('orb-badge');
  if (orbBadge) { badge.style.display = ''; badge.textContent = orbBadge; } else { badge.style.display = 'none'; }

  /* mock url */
  const urlWrap = document.getElementById('mock-url-wrap');
  if (hasMock && project?.mockUrl) {
    _mockUrl = project.mockUrl;
    document.getElementById('mock-url-text').textContent = project.mockUrl;
    urlWrap.style.display = 'block';
  } else { urlWrap.style.display = 'none'; }

  /* stats */
  const statsEl = document.getElementById('stats');
  if (hasTraffic) {
    statsEl.style.display = 'grid';
    statsEl.innerHTML =
      statCard(project.trafficCount, 'Requests', '') +
      statCard(project.endpointCount || '—', 'APIs', '') +
      statCard(project.dynamicRouteCount || '—', 'Dynamic', 'teal') +
      statCard(project.paginatedEndpointCount || '—', 'Paginated', 'amber');
  } else {
    statsEl.style.display = 'none';
  }

  /* buttons */
  const capLabel  = isCapturing  ? '<span class="spinner"></span>&nbsp;Capturing…'  : '📡&nbsp;&nbsp;Capture Traffic';
  const startLabel= isGenerating ? '<span class="spinner"></span>&nbsp;Starting…'   : '🚀&nbsp;&nbsp;Start Mock';
  const stopLabel = isStopping   ? '<span class="spinner"></span>&nbsp;Stopping…'   : '⏹&nbsp;&nbsp;Stop Server';

  let btnsHtml = \`
    <button class="btn btn-capture" id="btn-capture" \${isBusy?'disabled':''} onclick="send('capture')">\${capLabel}</button>
    <button class="btn btn-start" id="btn-start" \${isBusy||hasMock?'disabled':''} onclick="send('startMock')">\${startLabel}</button>
  \`;
  if (hasMock) {
    btnsHtml += \`<button class="btn btn-stop" \${isBusy?'disabled':''} onclick="send('stop')">\${stopLabel}</button>\`;
    btnsHtml += \`<hr class="divider"><button class="btn btn-dashboard" onclick="send('openDashboard')">📊&nbsp;&nbsp;Open Dashboard</button>\`;
  }
  document.getElementById('btns').innerHTML = btnsHtml;

  /* message */
  const msgEl = document.getElementById('msg');
  if (isError && statusMessage) {
    msgEl.innerHTML = '<div class="msg msg-error">' + escHtml(statusMessage) + '</div>';
  } else if (statusMessage && (hasMock || isCaptured)) {
    msgEl.innerHTML = '<div class="msg msg-success">' + escHtml(statusMessage) + '</div>';
  } else if (!hasTraffic && !isBusy && state === 'idle') {
    msgEl.innerHTML = '<div class="onboard">Click <strong>📡 Capture Traffic</strong><br>to import a HAR file or start the live proxy.</div>';
  } else {
    msgEl.innerHTML = '';
  }
}

function wizardHtml(s0, s1, s2) {
  return [
    ['📡', 'Capture', s0],
    ['⚙️', 'Generate', s1],
    ['🟢', 'Running', s2],
  ].map(([icon, lbl, st]) => \`
    <div class="wizard-step \${st}">
      <div class="wizard-icon">\${icon}</div>
      <div class="wizard-label">\${lbl}</div>
    </div>
  \`).join('');
}

function statCard(val, label, extra) {
  return \`<div class="stat-card \${extra}"><div class="stat-val">\${val}</div><div class="stat-lbl">\${label}</div></div>\`;
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function send(command) {
  if (command === 'copyUrl') {
    vscode.postMessage({ command: 'copyUrl', url: _mockUrl });
  } else {
    vscode.postMessage({ command });
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
exports.TrafficGhostSidebarProvider = TrafficGhostSidebarProvider;
TrafficGhostSidebarProvider.viewType = "trafficghost.sidebar";
//# sourceMappingURL=TrafficGhostSidebarProvider.js.map