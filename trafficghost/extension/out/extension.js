"use strict";
// TrafficGhost — Extension Entry Point
// Activates the VS Code extension, spawns the core engine, registers commands.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const EngineClient_1 = require("./services/EngineClient");
const TrafficGhostSidebarProvider_1 = require("./sidebar/TrafficGhostSidebarProvider");
const DashboardPanel_1 = require("./panels/DashboardPanel");
let outputChannel;
let engineProcess;
let engineClient;
let sidebarProvider;
let extensionCtx;
function activate(context) {
    extensionCtx = context;
    outputChannel = vscode.window.createOutputChannel("TrafficGhost");
    const cfg = vscode.workspace.getConfiguration("trafficghost");
    const controlPort = cfg.get("controlPort") ?? 4001;
    engineClient = new EngineClient_1.EngineClient(controlPort);
    // ── Sidebar ──────────────────────────────────────────────────────────────
    sidebarProvider = new TrafficGhostSidebarProvider_1.TrafficGhostSidebarProvider(context.extensionUri, engineClient, handleCapture, handleStartMock, handleStop, () => DashboardPanel_1.DashboardPanel.createOrShow(context.extensionUri, engineClient));
    const sidebarView = vscode.window.registerWebviewViewProvider(TrafficGhostSidebarProvider_1.TrafficGhostSidebarProvider.viewType, sidebarProvider, { webviewOptions: { retainContextWhenHidden: true } });
    // ── Commands ─────────────────────────────────────────────────────────────
    const captureCmd = vscode.commands.registerCommand("trafficghost.captureTraffic", handleCapture);
    const startCmd = vscode.commands.registerCommand("trafficghost.startMock", handleStartMock);
    const stopCmd = vscode.commands.registerCommand("trafficghost.stopServer", handleStop);
    const dashboardCmd = vscode.commands.registerCommand("trafficghost.openDashboard", () => DashboardPanel_1.DashboardPanel.createOrShow(context.extensionUri, engineClient));
    const resetCmd = vscode.commands.registerCommand("trafficghost.resetProject", handleReset);
    context.subscriptions.push(sidebarView, captureCmd, startCmd, stopCmd, dashboardCmd, resetCmd, outputChannel, vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("trafficghost.exasol")) {
            syncExasolSettings();
        }
    }));
    // ── Start engine ─────────────────────────────────────────────────────────
    startEngine(context, controlPort);
}
function deactivate() {
    stopEngine();
}
// ─── Engine Process Management ────────────────────────────────────────────
function startEngine(context, controlPort) {
    // Resolve workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.globalStorageUri.fsPath;
    // Find the core engine entry point
    // Try: sibling core/dist/index.js (built), then core/src/index.ts (tsx dev)
    const extDir = context.extensionPath;
    const coreDistPath = path.join(extDir, "..", "core", "dist", "index.js");
    const coreSrcPath = path.join(extDir, "..", "core", "src", "index.ts");
    let command;
    let args;
    let cwd;
    if (fs.existsSync(coreDistPath)) {
        command = "node";
        args = [coreDistPath, workspaceRoot];
        cwd = path.dirname(coreDistPath);
        outputChannel.appendLine(`[TrafficGhost] Starting engine (built): ${coreDistPath}`);
    }
    else if (fs.existsSync(coreSrcPath)) {
        // Dev mode: use tsx
        command = "npx";
        args = ["tsx", coreSrcPath, workspaceRoot];
        cwd = path.join(extDir, "..", "core");
        outputChannel.appendLine(`[TrafficGhost] Starting engine (dev/tsx): ${coreSrcPath}`);
    }
    else {
        vscode.window.showErrorMessage("TrafficGhost: Could not find the core engine. Run `npm run build` in the core/ directory.");
        return;
    }
    const env = {
        ...process.env,
        TG_CONTROL_PORT: String(controlPort),
        NODE_ENV: "production",
    };
    engineProcess = (0, child_process_1.spawn)(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    engineProcess.stdout?.on("data", (data) => {
        const text = data.toString();
        outputChannel.append(text);
        // Detect readiness signal
        if (text.includes("TRAFFICGHOST_READY:")) {
            outputChannel.appendLine("[TrafficGhost] Engine ready.");
            vscode.window.showInformationMessage("👻 TrafficGhost is ready! Click 📡 CAPTURE TRAFFIC to begin.");
            syncExasolSettings();
        }
    });
    engineProcess.stderr?.on("data", (data) => {
        outputChannel.append(data.toString());
    });
    engineProcess.on("error", (err) => {
        outputChannel.appendLine(`[TrafficGhost] Engine error: ${err.message}`);
        vscode.window.showErrorMessage(`TrafficGhost engine failed to start: ${err.message}`);
        engineProcess = undefined;
    });
    engineProcess.on("exit", (code, signal) => {
        outputChannel.appendLine(`[TrafficGhost] Engine exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
        if (code !== 0 && code !== null) {
            vscode.window.showWarningMessage(`TrafficGhost engine stopped unexpectedly (exit ${code}). Check the Output panel.`);
        }
        engineProcess = undefined;
    });
}
function syncExasolSettings() {
    const cfg = vscode.workspace.getConfiguration("trafficghost.exasol");
    const host = cfg.get("host") ?? "localhost";
    const port = cfg.get("port") ?? 8563;
    const user = cfg.get("user") ?? "sys";
    const password = cfg.get("password") ?? "exasol";
    const schema = cfg.get("schema") ?? "TRAFFICGHOST";
    const aiApiKey = cfg.get("aiApiKey") ?? "";
    engineClient.updateSettings({
        exasol: { host, port, user, password, schema, aiApiKey }
    }).catch(() => { });
}
function stopEngine() {
    if (!engineProcess)
        return;
    if (process.platform === "win32") {
        try {
            const { execFileSync } = require("child_process");
            execFileSync("taskkill", ["/PID", String(engineProcess.pid), "/T", "/F"], { stdio: "ignore" });
        }
        catch { }
    }
    else {
        try {
            engineProcess.kill("SIGTERM");
        }
        catch { }
    }
    engineProcess = undefined;
}
// ─── Ensure engine is running ─────────────────────────────────────────────
async function ensureEngine() {
    // Give it up to 8 seconds
    for (let i = 0; i < 16; i++) {
        const ok = await engineClient.isReachable();
        if (ok)
            return true;
        await sleep(500);
    }
    vscode.window.showErrorMessage("TrafficGhost engine is not responding. Check the TrafficGhost Output channel.");
    return false;
}
// ─── Primary Command Handlers ─────────────────────────────────────────────
async function handleCapture() {
    if (!(await ensureEngine()))
        return;
    // Offer HAR or Proxy
    const choice = await vscode.window.showQuickPick([
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
    ], {
        placeHolder: "How would you like to capture API traffic?",
        title: "📡 TrafficGhost — Capture Traffic",
    });
    if (!choice)
        return;
    if (choice.value === "har") {
        await handleHarImport();
    }
    else {
        await handleProxyStart();
    }
}
async function handleHarImport() {
    const files = await vscode.window.showOpenDialog({
        title: "Select HAR File",
        filters: { "HAR Files": ["har"], "All Files": ["*"] },
        canSelectMany: false,
        openLabel: "Import",
    });
    if (!files || files.length === 0)
        return;
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
        outputChannel.appendLine(`[TrafficGhost] Analysis: ${stats.totalEndpoints} endpoints, ${stats.dynamicRoutes} dynamic, ${stats.paginatedEndpoints} paginated.`);
        const project = await engineClient.getProject();
        sidebarProvider.setProject(project);
        sidebarProvider.setState("captured", `✓ ${stats.totalEndpoints} APIs · ${stats.dynamicRoutes} dynamic · ${stats.paginatedEndpoints} paginated`);
        vscode.window.showInformationMessage(`👻 TrafficGhost: ${result.imported} requests → ${stats.totalEndpoints} APIs detected. Click 🚀 START MOCK to continue.`);
    }
    catch (e) {
        const msg = e.message;
        outputChannel.appendLine(`[TrafficGhost] Import error: ${msg}`);
        sidebarProvider.setState("error", msg);
        vscode.window.showErrorMessage(`TrafficGhost: ${msg}`);
    }
}
async function handleProxyStart() {
    sidebarProvider.setState("capturing", "Starting proxy on :7777...");
    try {
        const result = await engineClient.startProxy();
        outputChannel.appendLine(`[TrafficGhost] Proxy started: ${result.url}`);
        const action = await vscode.window.showInformationMessage(`👻 TrafficGhost Proxy running on ${result.url}. Configure your browser to use this HTTP proxy, then click Stop Capture when done.`, "Stop Capture");
        if (action === "Stop Capture") {
            await handleProxyStop();
        }
    }
    catch (e) {
        const msg = e.message;
        sidebarProvider.setState("error", msg);
        vscode.window.showErrorMessage(`TrafficGhost proxy: ${msg}`);
    }
}
async function handleProxyStop() {
    try {
        await engineClient.stopProxy();
        sidebarProvider.setState("capturing", "Analyzing captured traffic...");
        const analysis = await engineClient.analyze();
        const { stats } = analysis;
        const project = await engineClient.getProject();
        sidebarProvider.setProject(project);
        sidebarProvider.setState("captured", `✓ ${stats.totalRequests} requests · ${stats.totalEndpoints} APIs`);
        vscode.window.showInformationMessage(`👻 Captured ${stats.totalRequests} requests → ${stats.totalEndpoints} APIs. Click 🚀 START MOCK to continue.`);
    }
    catch (e) {
        sidebarProvider.setState("error", e.message);
    }
}
async function handleStartMock() {
    if (!(await ensureEngine()))
        return;
    sidebarProvider.setState("generating", "Generating mock definitions...");
    try {
        const cfg = vscode.workspace.getConfiguration("trafficghost");
        const mockPort = cfg.get("mockPort") ?? 4000;
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
        const dashboard = DashboardPanel_1.DashboardPanel.createOrShow(extensionCtx.extensionUri, engineClient);
        // Push endpoints to dashboard
        try {
            const endpoints = await engineClient.getProject();
            // The dashboard polls from engine directly; also push endpoints
            setTimeout(async () => {
                try {
                    const resp = await fetch(`http://localhost:${cfg.get("controlPort") ?? 4001}/endpoints`);
                    const eps = await resp.json();
                    dashboard.pushEndpoints(eps);
                }
                catch { }
            }, 500);
        }
        catch { }
        // Write .env.local for frontend
        writeEnvLocal(startResult.url);
        await vscode.window.showInformationMessage(`👻 Mock backend running at ${startResult.url}  (${gen.count} routes)`, "Copy URL").then((action) => {
            if (action === "Copy URL") {
                vscode.env.clipboard.writeText(startResult.url);
            }
        });
    }
    catch (e) {
        const msg = e.message;
        outputChannel.appendLine(`[TrafficGhost] Start mock error: ${msg}`);
        sidebarProvider.setState("error", msg);
        vscode.window.showErrorMessage(`TrafficGhost: ${msg}`);
    }
}
async function handleStop() {
    sidebarProvider.setState("stopping", "Stopping mock server...");
    try {
        await engineClient.stopMockServer();
        const project = await engineClient.getProject();
        sidebarProvider.setProject(project);
        sidebarProvider.setState("captured", "Mock server stopped.");
        outputChannel.appendLine("[TrafficGhost] Mock server stopped.");
    }
    catch (e) {
        sidebarProvider.setState("error", e.message);
    }
}
async function handleReset() {
    const confirm = await vscode.window.showWarningMessage("Reset TrafficGhost? This will clear all captured traffic and stop the mock server.", { modal: true }, "Reset");
    if (confirm !== "Reset")
        return;
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
    }
    catch (e) {
        vscode.window.showErrorMessage(`TrafficGhost reset failed: ${e.message}`);
    }
}
// ─── Helpers ─────────────────────────────────────────────────────────────
function writeEnvLocal(apiUrl) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders)
        return;
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
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=extension.js.map