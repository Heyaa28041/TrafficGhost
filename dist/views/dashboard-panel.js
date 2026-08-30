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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficGhostDashboardPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const workspace_manager_1 = require("../storage/workspace-manager");
const output_channel_1 = require("../logging/output-channel");
const workspace_scanner_1 = require("../analyzer/workspace-scanner");
const integration_advisor_1 = require("../analyzer/integration-advisor");
const resilience_analyzer_1 = require("../analyzer/resilience-analyzer");
const captured_request_1 = require("../models/captured-request");
class TrafficGhostDashboardPanel {
    serverManager;
    recorder;
    getCapturedRequests;
    onAction;
    static currentPanel;
    _panel;
    _extensionUri;
    _disposables = [];
    disposed = false;
    static createOrShow(extensionUri, serverManager, recorder, getCapturedRequests, onAction) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (TrafficGhostDashboardPanel.currentPanel) {
            TrafficGhostDashboardPanel.currentPanel._panel.reveal(column);
            TrafficGhostDashboardPanel.currentPanel.syncStateSafely();
            return TrafficGhostDashboardPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('trafficGhostDashboard', 'TrafficGhost Dashboard', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'dist'),
                vscode.Uri.joinPath(extensionUri, 'src', 'webview')
            ]
        });
        TrafficGhostDashboardPanel.currentPanel = new TrafficGhostDashboardPanel(panel, extensionUri, serverManager, recorder, getCapturedRequests, onAction);
        return TrafficGhostDashboardPanel.currentPanel;
    }
    constructor(panel, extensionUri, serverManager, recorder, getCapturedRequests, onAction) {
        this.serverManager = serverManager;
        this.recorder = recorder;
        this.getCapturedRequests = getCapturedRequests;
        this.onAction = onAction;
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.updateWebviewContent();
        this._panel.onDidDispose(() => {
            this.disposed = true;
            TrafficGhostDashboardPanel.currentPanel = undefined;
            this.disposeListeners();
        }, null, this._disposables);
        // Listen to messages from Webview UI
        this._panel.webview.onDidReceiveMessage(async (message) => {
            try {
                await this.handleWebviewMessage(message);
            }
            catch (err) {
                output_channel_1.logger.error(`Error handling webview message: ${err}`);
            }
        }, null, this._disposables);
        // Listen to server events
        const syncState = () => {
            this.syncStateSafely();
        };
        const serverEvents = ['stateChanged', 'serverRequest', 'scenarioChanged', 'schemaChanged'];
        for (const event of serverEvents) {
            serverManager.on(event, syncState);
            this._disposables.push(new vscode.Disposable(() => serverManager.removeListener(event, syncState)));
        }
        const recorderEvents = ['captured', 'started', 'stopped'];
        for (const event of recorderEvents) {
            recorder.on(event, syncState);
            this._disposables.push(new vscode.Disposable(() => recorder.removeListener(event, syncState)));
        }
    }
    selectEndpoint(endpointId) {
        if (this.disposed)
            return;
        this._panel.webview.postMessage({
            type: 'SELECT_ENDPOINT',
            endpointId
        });
    }
    async syncState() {
        if (this.disposed || !this._panel.visible)
            return;
        const schema = this.serverManager.getSchema();
        const config = this.serverManager.getConfig();
        const isRunning = this.serverManager.isRunning();
        const isRecording = this.recorder.getIsRecording();
        const captured = this.getCapturedRequests();
        const history = this.serverManager.getRequestHistory();
        const framework = workspace_manager_1.WorkspaceManager.getInstance().detectFrontendFramework();
        const sessions = workspace_manager_1.WorkspaceManager.getInstance().loadGhostSessions();
        const isGhostMode = this.serverManager.isGhostMode();
        const activeGhostSession = this.serverManager.getActiveGhostSession();
        const root = workspace_manager_1.WorkspaceManager.getInstance().getWorkspaceRoot() || '';
        // 1. Scan results mapping
        const scanResults = root && schema ? await workspace_scanner_1.WorkspaceScanner.scanAllEndpoints(schema, root) : [];
        if (this.disposed)
            return;
        // 2. Integration advisor mapping & Resilience analyzer mapping
        const integrationAdvice = {};
        const resilienceReports = {};
        let integratedCount = 0;
        if (schema) {
            for (const ep of schema.restEndpoints || []) {
                const scan = scanResults.find(r => r.endpointId === ep.id);
                const usages = scan ? scan.usages : [];
                if (usages.length > 0) {
                    integratedCount++;
                    resilienceReports[ep.id] = resilience_analyzer_1.ResilienceAnalyzer.analyzeUsages(usages);
                }
                else {
                    integrationAdvice[ep.id] = root ? integration_advisor_1.IntegrationAdvisor.suggestLocations(ep.pathPattern, root) : [];
                }
            }
        }
        // 3. API Coverage calculations
        const restTotal = schema?.restEndpoints?.length || 0;
        const gqlTotal = schema?.graphqlEndpoints?.length || 0;
        const totalEndpoints = restTotal + gqlTotal;
        const unintegratedCount = restTotal - integratedCount;
        const coveragePercent = totalEndpoints > 0 ? Math.round((integratedCount / totalEndpoints) * 1000) / 10 : 0;
        // 4. Performance Insights grouping
        const performanceInsights = {};
        if (schema) {
            for (const ep of schema.restEndpoints || []) {
                // Find matching requests from captured requests to compute true statistics
                const matchingReqs = captured.filter(r => {
                    const cleanReqPath = r.path.replace(/\/\d+/g, '/:id'); // param normalization
                    const cleanEpPath = ep.pathPattern.replace(/:[a-zA-Z0-9]+/g, ':id');
                    return cleanReqPath.toLowerCase() === cleanEpPath.toLowerCase() && r.method === ep.method;
                });
                if (matchingReqs.length > 0) {
                    const durations = matchingReqs.map(r => r.timing?.duration || 0).filter(d => d > 0);
                    if (durations.length > 0) {
                        const sum = durations.reduce((a, b) => a + b, 0);
                        performanceInsights[ep.id] = {
                            avg: Math.round(sum / durations.length),
                            min: Math.min(...durations),
                            max: Math.max(...durations),
                            count: durations.length
                        };
                    }
                }
            }
        }
        // 5. Sensitive data scanning warning
        let sensitiveDataWarning = false;
        for (const req of captured) {
            if ((0, captured_request_1.detectSensitiveData)(req)) {
                sensitiveDataWarning = true;
                break;
            }
        }
        if (this.disposed)
            return;
        await this._panel.webview.postMessage({
            type: 'SYNC_STATE',
            state: {
                schema,
                config,
                isRunning,
                isRecording,
                capturedCount: captured.length,
                capturedRequests: captured.slice(-50), // Send latest 50 for UI performance
                serverHistory: history.slice(0, 50),
                framework,
                port: this.serverManager.getPort(),
                sessions,
                isGhostMode,
                activeGhostSession,
                // New developer analytics fields
                scanResults,
                integrationAdvice,
                resilienceReports,
                sensitiveDataWarning,
                coverage: {
                    total: totalEndpoints,
                    restTotal,
                    gqlTotal,
                    integrated: integratedCount,
                    unintegrated: unintegratedCount,
                    percent: coveragePercent
                },
                performanceInsights
            }
        });
    }
    syncStateSafely() {
        if (this.disposed)
            return;
        void this.syncState().catch((err) => {
            output_channel_1.logger.error(`Error syncing dashboard state: ${err}`);
        });
    }
    async handleWebviewMessage(message) {
        const { type, payload } = message;
        switch (type) {
            case 'GET_INITIAL_STATE':
                await this.syncState();
                break;
            case 'ACTION':
                await this.onAction(payload.action, payload.data);
                await this.syncState();
                break;
            case 'UPDATE_SCENARIO':
                this.serverManager.setGlobalScenario(payload.scenario);
                workspace_manager_1.WorkspaceManager.getInstance().saveConfig(this.serverManager.getConfig());
                await this.syncState();
                break;
            case 'UPDATE_CONFIG':
                const updatedConfig = { ...this.serverManager.getConfig(), ...payload.config };
                this.serverManager.setConfig(updatedConfig);
                workspace_manager_1.WorkspaceManager.getInstance().saveConfig(updatedConfig);
                await this.syncState();
                break;
            case 'UPDATE_REST_ENDPOINT':
                const schema = this.serverManager.getSchema();
                const epIndex = schema.restEndpoints.findIndex((e) => e.id === payload.endpoint.id);
                if (epIndex >= 0) {
                    schema.restEndpoints[epIndex] = payload.endpoint;
                    this.serverManager.setSchema(schema);
                    workspace_manager_1.WorkspaceManager.getInstance().saveSchema(schema);
                }
                await this.syncState();
                break;
            case 'UPDATE_GRAPHQL_ENDPOINT':
                const gSchema = this.serverManager.getSchema();
                const gIndex = gSchema.graphqlEndpoints.findIndex((g) => g.id === payload.endpoint.id);
                if (gIndex >= 0) {
                    gSchema.graphqlEndpoints[gIndex] = payload.endpoint;
                    this.serverManager.setSchema(gSchema);
                    workspace_manager_1.WorkspaceManager.getInstance().saveSchema(gSchema);
                }
                await this.syncState();
                break;
            case 'CLEAR_HISTORY':
                this.serverManager.clearRequestHistory();
                await this.syncState();
                break;
            case 'ENTER_GHOST_MODE':
                await vscode.commands.executeCommand('trafficghost.enterGhostMode', payload.sessionId);
                await this.syncState();
                break;
            case 'EXIT_GHOST_MODE':
                await vscode.commands.executeCommand('trafficghost.exitGhostMode');
                await this.syncState();
                break;
            case 'START_GHOST_SESSION':
                await vscode.commands.executeCommand('trafficghost.startGhostSession');
                await this.syncState();
                break;
            case 'STOP_GHOST_SESSION':
                await vscode.commands.executeCommand('trafficghost.stopGhostSession');
                await this.syncState();
                break;
            case 'DELETE_GHOST_SESSION':
                await vscode.commands.executeCommand('trafficghost.deleteSession', payload.sessionId);
                this.syncState();
                break;
            case 'RENAME_GHOST_SESSION':
                await vscode.commands.executeCommand('trafficghost.renameSession', payload.sessionId);
                this.syncState();
                break;
            case 'GENERATE_TYPES':
                await vscode.commands.executeCommand('trafficghost.generateTypes', payload.endpointId);
                break;
            case 'GENERATE_CLIENT':
                await vscode.commands.executeCommand('trafficghost.generateClient', payload.endpointId);
                break;
            case 'GENERATE_TEST':
                await vscode.commands.executeCommand('trafficghost.generateTest', payload.endpointId);
                break;
            case 'GENERATE_DOCS':
                await vscode.commands.executeCommand('trafficghost.generateDocs');
                break;
            case 'COMPARE_CONTRACTS':
                await vscode.commands.executeCommand('trafficghost.diffContracts');
                break;
            case 'GENERATE_RESILIENCE_TEST':
                await vscode.commands.executeCommand('trafficghost.generateResilienceTest', payload.endpointId);
                break;
            case 'INSERT_API_PLACEHOLDER':
                await vscode.commands.executeCommand('trafficghost.insertApiPlaceholder', payload.endpointId);
                break;
            case 'GENERATE_INTEGRATION':
                await vscode.commands.executeCommand('trafficghost.generateIntegration', payload.endpointId);
                break;
            default:
                output_channel_1.logger.warn(`Unknown webview message type: ${type}`);
        }
    }
    updateWebviewContent() {
        const webview = this._panel.webview;
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'dashboard.html');
        const cssPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'dashboard.css');
        const jsPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'dashboard.js');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        const cssContent = fs.readFileSync(cssPath, 'utf-8');
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        // Inline CSS and JS for CSP reliability
        htmlContent = htmlContent.replace('<!-- INLINE_CSS -->', `<style>${cssContent}</style>`);
        htmlContent = htmlContent.replace('<!-- INLINE_JS -->', `<script>${jsContent}</script>`);
        webview.html = htmlContent;
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        TrafficGhostDashboardPanel.currentPanel = undefined;
        this._panel.dispose();
        this.disposeListeners();
    }
    disposeListeners() {
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
exports.TrafficGhostDashboardPanel = TrafficGhostDashboardPanel;
//# sourceMappingURL=dashboard-panel.js.map