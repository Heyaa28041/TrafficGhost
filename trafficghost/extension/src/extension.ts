// TrafficGhost — Extension Entry Point
// Activates the VS Code extension, spawns the core engine, registers commands.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { EngineClient } from "./services/EngineClient";
import { TrafficGhostSidebarProvider } from "./sidebar/TrafficGhostSidebarProvider";
import { DashboardPanel } from "./panels/DashboardPanel";

let outputChannel: vscode.OutputChannel;
let engineProcess: ChildProcess | undefined;
let engineClient: EngineClient;
let sidebarProvider: TrafficGhostSidebarProvider;
let extensionCtx: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext): void {
  extensionCtx = context;
  outputChannel = vscode.window.createOutputChannel("TrafficGhost");

  const cfg = vscode.workspace.getConfiguration("trafficghost");
  const controlPort: number = cfg.get("controlPort") ?? 4001;

  engineClient = new EngineClient(controlPort);

  // ── Sidebar ──────────────────────────────────────────────────────────────
  sidebarProvider = new TrafficGhostSidebarProvider(
    context.extensionUri,
    engineClient,
    handleCapture,
    handleStartMock,
    handleStop,
    () => DashboardPanel.createOrShow(context.extensionUri, engineClient)
  );

  const sidebarView = vscode.window.registerWebviewViewProvider(
    TrafficGhostSidebarProvider.viewType,
    sidebarProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  );

  // ── Commands ─────────────────────────────────────────────────────────────
  const captureCmd = vscode.commands.registerCommand(
    "trafficghost.captureTraffic",
    handleCapture
  );
  const startCmd = vscode.commands.registerCommand(
    "trafficghost.startMock",
    handleStartMock
  );
  const stopCmd = vscode.commands.registerCommand(
    "trafficghost.stopServer",
    handleStop
  );
  const dashboardCmd = vscode.commands.registerCommand(
    "trafficghost.openDashboard",
    () => DashboardPanel.createOrShow(context.extensionUri, engineClient)
  );
  const resetCmd = vscode.commands.registerCommand(
    "trafficghost.resetProject",
    handleReset
  );

  context.subscriptions.push(
    sidebarView,
    captureCmd,
    startCmd,
    stopCmd,
    dashboardCmd,
    resetCmd,
    outputChannel,
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("trafficghost.exasol")) {
        syncExasolSettings();
      }
    })
  );

  // ── Start engine ─────────────────────────────────────────────────────────
  startEngine(context, controlPort);
}

export function deactivate(): void {
  stopEngine();
}

// ─── Engine Process Management ────────────────────────────────────────────

function startEngine(context: vscode.ExtensionContext, controlPort: number): void {
  // Resolve workspace root
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.globalStorageUri.fsPath;

  // Find the core engine entry point
  // Try: sibling core/dist/index.js (built), then core/src/index.ts (tsx dev)
  const extDir = context.extensionPath;
  const coreDistPath = path.join(extDir, "..", "core", "dist", "index.js");
  const coreSrcPath = path.join(extDir, "..", "core", "src", "index.ts");

  let command: string;
  let args: string[];
  let cwd: string;

  if (fs.existsSync(coreDistPath)) {
    command = "node";
    args = [coreDistPath, workspaceRoot];
    cwd = path.dirname(coreDistPath);
    outputChannel.appendLine(`[TrafficGhost] Starting engine (built): ${coreDistPath}`);
  } else if (fs.existsSync(coreSrcPath)) {
    // Dev mode: use tsx
    command = "npx";
    args = ["tsx", coreSrcPath, workspaceRoot];
    cwd = path.join(extDir, "..", "core");
    outputChannel.appendLine(`[TrafficGhost] Starting engine (dev/tsx): ${coreSrcPath}`);
  } else {
    vscode.window.showErrorMessage(
      "TrafficGhost: Could not find the core engine. Run `npm run build` in the core/ directory."
    );
    return;
  }

  const env = {
    ...process.env,
    TG_CONTROL_PORT: String(controlPort),
    NODE_ENV: "production",
  };

  engineProcess = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });

  engineProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    outputChannel.append(text);

    // Detect readiness signal
    if (text.includes("TRAFFICGHOST_READY:")) {
      outputChannel.appendLine("[TrafficGhost] Engine ready.");
      vscode.window.showInformationMessage(
        "👻 TrafficGhost is ready! Click 📡 CAPTURE TRAFFIC to begin."
      );
      syncExasolSettings();
    }
  });

  engineProcess.stderr?.on("data", (data: Buffer) => {
    outputChannel.append(data.toString());
  });

  engineProcess.on("error", (err) => {
    outputChannel.appendLine(`[TrafficGhost] Engine error: ${err.message}`);
    vscode.window.showErrorMessage(`TrafficGhost engine failed to start: ${err.message}`);
    engineProcess = undefined;
  });

  engineProcess.on("exit", (code, signal) => {
    outputChannel.appendLine(
      `[TrafficGhost] Engine exited (code=${code ?? "null"}, signal=${signal ?? "null"})`
    );
    if (code !== 0 && code !== null) {
      vscode.window.showWarningMessage(
        `TrafficGhost engine stopped unexpectedly (exit ${code}). Check the Output panel.`
      );
    }
    engineProcess = undefined;
  });
}

function syncExasolSettings(): void {
  const cfg = vscode.workspace.getConfiguration("trafficghost.exasol");
  const host = cfg.get<string>("host") ?? "localhost";
  const port = cfg.get<number>("port") ?? 8563;
  const user = cfg.get<string>("user") ?? "sys";
  const password = cfg.get<string>("password") ?? "exasol";
  const schema = cfg.get<string>("schema") ?? "TRAFFICGHOST";
  const aiApiKey = cfg.get<string>("aiApiKey") ?? "";

  engineClient.updateSettings({
    exasol: { host, port, user, password, schema, aiApiKey }
  }).catch(() => {});
}

function stopEngine(): void {
  if (!engineProcess) return;
  if (process.platform === "win32") {
    try {
      const { execFileSync } = require("child_process");
      execFileSync("taskkill", ["/PID", String(engineProcess.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
  } else {
    try { engineProcess.kill("SIGTERM"); } catch {}
  }
  engineProcess = undefined;
}

// ─── Ensure engine is running ─────────────────────────────────────────────

async function ensureEngine(): Promise<boolean> {
  // Give it up to 8 seconds
  for (let i = 0; i < 16; i++) {
    const ok = await engineClient.isReachable();
    if (ok) return true;
    await sleep(500);
  }
  vscode.window.showErrorMessage(
    "TrafficGhost engine is not responding. Check the TrafficGhost Output channel."
  );
  return false;
}

// ─── Primary Command Handlers ─────────────────────────────────────────────

async function handleCapture(): Promise<void> {
  if (!(await ensureEngine())) return;

  // Offer HAR or Proxy
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "$(file-code) Import HAR File",
        description: "Load a .har capture file exported from browser DevTools",
        value: "har",
      },
      {
        label: "$(radio-tower) Start Live Proxy",
        description: "Capture real traffic through a local HTTP proxy on :7777",
        value: "proxy",
      },
    ],
    {
      placeHolder: "How would you like to capture API traffic?",
      title: "📡 TrafficGhost — Capture Traffic",
    }
  );

  if (!choice) return;

  if ((choice as { value: string }).value === "har") {
    await handleHarImport();
  } else {
    await handleProxyStart();
  }
}

async function handleHarImport(): Promise<void> {
  const files = await vscode.window.showOpenDialog({
    title: "Select HAR File",
    filters: { "HAR Files": ["har"], "All Files": ["*"] },
    canSelectMany: false,
    openLabel: "Import",
  });

  if (!files || files.length === 0) return;

  const filePath = files[0].fsPath;
  sidebarProvider.setState("capturing", "Importing HAR file...");

  try {
    outputChannel.appendLine(`[TrafficGhost] Importing HAR: ${filePath}`);
    const result = await engineClient.importHarFile(filePath);
    outputChannel.appendLine(`[TrafficGhost] Imported ${result.imported} requests, skipped ${result.skipped}.`);

    // Auto-analyze
    sidebarProvider.setState("capturing", "Analyzing API traffic...");
    const analysis = await engineClient.analyze();
    const { stats } = analysis;

    outputChannel.appendLine(
      `[TrafficGhost] Analysis: ${stats.totalEndpoints} endpoints, ${stats.dynamicRoutes} dynamic, ${stats.paginatedEndpoints} paginated.`
    );

    const project = await engineClient.getProject();
    sidebarProvider.setProject(project);
    sidebarProvider.setState(
      "captured",
      `✓ ${stats.totalEndpoints} APIs · ${stats.dynamicRoutes} dynamic · ${stats.paginatedEndpoints} paginated`
    );

    vscode.window.showInformationMessage(
      `👻 TrafficGhost: ${result.imported} requests → ${stats.totalEndpoints} APIs detected. Click 🚀 START MOCK to continue.`
    );
  } catch (e) {
    const msg = (e as Error).message;
    outputChannel.appendLine(`[TrafficGhost] Import error: ${msg}`);
    sidebarProvider.setState("error", msg);
    vscode.window.showErrorMessage(`TrafficGhost: ${msg}`);
  }
}

async function handleProxyStart(): Promise<void> {
  sidebarProvider.setState("capturing", "Starting proxy on :7777...");
  try {
    const result = await engineClient.startProxy();
    outputChannel.appendLine(`[TrafficGhost] Proxy started: ${result.url}`);

    const action = await vscode.window.showInformationMessage(
      `👻 TrafficGhost Proxy running on ${result.url}. Configure your browser to use this HTTP proxy, then click Stop Capture when done.`,
      "Stop Capture"
    );

    if (action === "Stop Capture") {
      await handleProxyStop();
    }
  } catch (e) {
    const msg = (e as Error).message;
    sidebarProvider.setState("error", msg);
    vscode.window.showErrorMessage(`TrafficGhost proxy: ${msg}`);
  }
}

async function handleProxyStop(): Promise<void> {
  try {
    await engineClient.stopProxy();
    sidebarProvider.setState("capturing", "Analyzing captured traffic...");
    const analysis = await engineClient.analyze();
    const { stats } = analysis;
    const project = await engineClient.getProject();
    sidebarProvider.setProject(project);
    sidebarProvider.setState(
      "captured",
      `✓ ${stats.totalRequests} requests · ${stats.totalEndpoints} APIs`
    );
    vscode.window.showInformationMessage(
      `👻 Captured ${stats.totalRequests} requests → ${stats.totalEndpoints} APIs. Click 🚀 START MOCK to continue.`
    );
  } catch (e) {
    sidebarProvider.setState("error", (e as Error).message);
  }
}

async function handleStartMock(): Promise<void> {
  if (!(await ensureEngine())) return;

  sidebarProvider.setState("generating", "Generating mock definitions...");

  try {
    const cfg = vscode.workspace.getConfiguration("trafficghost");
    const mockPort: number = cfg.get("mockPort") ?? 4000;

    // Generate mocks
    const gen = await engineClient.generateMocks();
    outputChannel.appendLine(`[TrafficGhost] Generated ${gen.count} mock routes.`);

    // Start server
    sidebarProvider.setState("generating", "Starting mock server...");
    const startResult = await engineClient.startMockServer(mockPort);
    outputChannel.appendLine(`[TrafficGhost] Mock server: ${startResult.url}`);

    const project = await engineClient.getProject();
    sidebarProvider.setProject(project);
    sidebarProvider.setState("running");

    // Open dashboard automatically
    const dashboard = DashboardPanel.createOrShow(extensionCtx.extensionUri, engineClient);
    // Push endpoints to dashboard
    try {
      const endpoints = await engineClient.getProject();
      // The dashboard polls from engine directly; also push endpoints
      setTimeout(async () => {
        try {
          const resp = await fetch(`http://localhost:${cfg.get<number>("controlPort") ?? 4001}/endpoints`);
          const eps = await resp.json();
          dashboard.pushEndpoints(eps as unknown[]);
        } catch {}
      }, 500);
    } catch {}

    // Write .env.local for frontend
    writeEnvLocal(startResult.url);

    await vscode.window.showInformationMessage(
      `👻 Mock backend running at ${startResult.url}  (${gen.count} routes)`,
      "Copy URL"
    ).then((action) => {
      if (action === "Copy URL") {
        vscode.env.clipboard.writeText(startResult.url);
      }
    });
  } catch (e) {
    const msg = (e as Error).message;
    outputChannel.appendLine(`[TrafficGhost] Start mock error: ${msg}`);
    sidebarProvider.setState("error", msg);
    vscode.window.showErrorMessage(`TrafficGhost: ${msg}`);
  }
}

async function handleStop(): Promise<void> {
  sidebarProvider.setState("stopping", "Stopping mock server...");
  try {
    await engineClient.stopMockServer();
    const project = await engineClient.getProject();
    sidebarProvider.setProject(project);
    sidebarProvider.setState("captured", "Mock server stopped.");
    outputChannel.appendLine("[TrafficGhost] Mock server stopped.");
  } catch (e) {
    sidebarProvider.setState("error", (e as Error).message);
  }
}

async function handleReset(): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    "Reset TrafficGhost? This will clear all captured traffic and stop the mock server.",
    { modal: true },
    "Reset"
  );
  if (confirm !== "Reset") return;

  try {
    await engineClient.resetProject();
    sidebarProvider.setState("idle", "");
    sidebarProvider.setProject({
      trafficCount: 0,
      endpointCount: 0,
      dynamicRouteCount: 0,
      paginatedEndpointCount: 0,
      mockRunning: false,
      proxyRunning: false,
    });
    outputChannel.appendLine("[TrafficGhost] Project reset.");
    vscode.window.showInformationMessage("TrafficGhost project reset.");
  } catch (e) {
    vscode.window.showErrorMessage(`TrafficGhost reset failed: ${(e as Error).message}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function writeEnvLocal(apiUrl: string): void {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  // Write .env.local to the demo/frontend directory if it exists
  const candidates = [
    path.join(folders[0].uri.fsPath, "demo", "frontend", ".env.local"),
    path.join(folders[0].uri.fsPath, ".env.local"),
  ];

  for (const envPath of candidates) {
    const dir = path.dirname(envPath);
    if (fs.existsSync(dir)) {
      let existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      existing = existing.replace(/^VITE_API_URL=.*$/m, "").trim();
      const newContent = `VITE_API_URL=${apiUrl}\n${existing}\n`.trim() + "\n";
      fs.writeFileSync(envPath, newContent, "utf-8");
      outputChannel.appendLine(`[TrafficGhost] Wrote ${envPath}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
