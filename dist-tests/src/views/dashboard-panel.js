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
class TrafficGhostDashboardPanel {
    serverManager;
    recorder;
    getCapturedRequests;
    onAction;
    static currentPanel;
    _panel;
    _extensionUri;
    _disposables = [];
    static createOrShow(extensionUri, serverManager, recorder, getCapturedRequests, onAction) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (TrafficGhostDashboardPanel.currentPanel) {
            TrafficGhostDashboardPanel.currentPanel._panel.reveal(column);
            TrafficGhostDashboardPanel.currentPanel.syncState();
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
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
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
        serverManager.on('stateChanged', () => this.syncState());
        serverManager.on('serverRequest', () => this.syncState());
        serverManager.on('scenarioChanged', () => this.syncState());
        serverManager.on('schemaChanged', () => this.syncState());
        recorder.on('captured', () => this.syncState());
        recorder.on('started', () => this.syncState());
        recorder.on('stopped', () => this.syncState());
    }
    selectEndpoint(endpointId) {
        this._panel.webview.postMessage({
            type: 'SELECT_ENDPOINT',
            endpointId
        });
    }
    syncState() {
        if (!this._panel.visible)
            return;
        const schema = this.serverManager.getSchema();
        const config = this.serverManager.getConfig();
        const isRunning = this.serverManager.isRunning();
        const isRecording = this.recorder.getIsRecording();
        const captured = this.getCapturedRequests();
        const history = this.serverManager.getRequestHistory();
        const framework = workspace_manager_1.WorkspaceManager.getInstance().detectFrontendFramework();
        this._panel.webview.postMessage({
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
                port: this.serverManager.getPort()
            }
        });
    }
    async handleWebviewMessage(message) {
        const { type, payload } = message;
        switch (type) {
            case 'GET_INITIAL_STATE':
                this.syncState();
                break;
            case 'ACTION':
                await this.onAction(payload.action, payload.data);
                this.syncState();
                break;
            case 'UPDATE_SCENARIO':
                this.serverManager.setGlobalScenario(payload.scenario);
                workspace_manager_1.WorkspaceManager.getInstance().saveConfig(this.serverManager.getConfig());
                this.syncState();
                break;
            case 'UPDATE_CONFIG':
                const updatedConfig = { ...this.serverManager.getConfig(), ...payload.config };
                this.serverManager.setConfig(updatedConfig);
                workspace_manager_1.WorkspaceManager.getInstance().saveConfig(updatedConfig);
                this.syncState();
                break;
            case 'UPDATE_REST_ENDPOINT':
                const schema = this.serverManager.getSchema();
                const epIndex = schema.restEndpoints.findIndex((e) => e.id === payload.endpoint.id);
                if (epIndex >= 0) {
                    schema.restEndpoints[epIndex] = payload.endpoint;
                    this.serverManager.setSchema(schema);
                    workspace_manager_1.WorkspaceManager.getInstance().saveSchema(schema);
                }
                this.syncState();
                break;
            case 'UPDATE_GRAPHQL_ENDPOINT':
                const gSchema = this.serverManager.getSchema();
                const gIndex = gSchema.graphqlEndpoints.findIndex((g) => g.id === payload.endpoint.id);
                if (gIndex >= 0) {
                    gSchema.graphqlEndpoints[gIndex] = payload.endpoint;
                    this.serverManager.setSchema(gSchema);
                    workspace_manager_1.WorkspaceManager.getInstance().saveSchema(gSchema);
                }
                this.syncState();
                break;
            case 'CLEAR_HISTORY':
                this.serverManager.clearRequestHistory();
                this.syncState();
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
        TrafficGhostDashboardPanel.currentPanel = undefined;
        this._panel.dispose();
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