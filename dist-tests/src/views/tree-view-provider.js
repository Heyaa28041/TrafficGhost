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
exports.GhostSessionsTreeProvider = exports.GraphQLEndpointsTreeProvider = exports.RestEndpointsTreeProvider = exports.ActionsTreeProvider = exports.StatusTreeProvider = exports.TrafficGhostTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const workspace_manager_1 = require("../storage/workspace-manager");
class TrafficGhostTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    descriptionText;
    iconName;
    commandId;
    commandArgs;
    constructor(label, collapsibleState, descriptionText, iconName, commandId, commandArgs) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.descriptionText = descriptionText;
        this.iconName = iconName;
        this.commandId = commandId;
        this.commandArgs = commandArgs;
        if (descriptionText) {
            this.description = descriptionText;
        }
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        }
        if (commandId) {
            this.command = {
                command: commandId,
                title: label,
                arguments: commandArgs
            };
        }
    }
}
exports.TrafficGhostTreeItem = TrafficGhostTreeItem;
class StatusTreeProvider {
    serverManager;
    recorder;
    getCapturedCount;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(serverManager, recorder, getCapturedCount) {
        this.serverManager = serverManager;
        this.recorder = recorder;
        this.getCapturedCount = getCapturedCount;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const isRecording = this.recorder.getIsRecording();
        const isServerRunning = this.serverManager.isRunning();
        const port = this.serverManager.getPort();
        const schema = this.serverManager.getSchema();
        const scenario = this.serverManager.getConfig().globalScenario;
        const capturedCount = this.getCapturedCount();
        const isGhostMode = this.serverManager.isGhostMode();
        const activeSession = this.serverManager.getActiveGhostSession();
        const items = [
            new TrafficGhostTreeItem('Backend Mode', vscode.TreeItemCollapsibleState.None, isGhostMode ? `GHOST MODE (${activeSession ? activeSession.name : 'Unknown'})` : 'REAL BACKEND', isGhostMode ? 'ghost' : 'globe', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('Recording', vscode.TreeItemCollapsibleState.None, isRecording ? '● Active' : '● Inactive', isRecording ? 'record' : 'circle-slash', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('Captured Traffic', vscode.TreeItemCollapsibleState.None, `${capturedCount} requests`, 'arrow-swap', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('REST Endpoints', vscode.TreeItemCollapsibleState.None, `${schema.restEndpoints.length} endpoints`, 'symbol-interface', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('GraphQL Operations', vscode.TreeItemCollapsibleState.None, `${schema.graphqlEndpoints.length} operations`, 'symbol-method', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('Mock Server', vscode.TreeItemCollapsibleState.None, isServerRunning ? `● Running (: ${port})` : 'Stopped', isServerRunning ? 'server-process' : 'server', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('Active Scenario', vscode.TreeItemCollapsibleState.None, scenario.toUpperCase(), 'gear', 'trafficghost.configureScenario')
        ];
        return Promise.resolve(items);
    }
}
exports.StatusTreeProvider = StatusTreeProvider;
class ActionsTreeProvider {
    serverManager;
    recorder;
    constructor(serverManager, recorder) {
        this.serverManager = serverManager;
        this.recorder = recorder;
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const isRecording = this.recorder.getIsRecording();
        const isRunning = this.serverManager.isRunning();
        const items = [
            new TrafficGhostTreeItem('Open Traffic Dashboard', vscode.TreeItemCollapsibleState.None, 'Webview UI', 'dashboard', 'trafficghost.openDashboard'),
            new TrafficGhostTreeItem('Import HAR File', vscode.TreeItemCollapsibleState.None, 'Load .har capture', 'file-code', 'trafficghost.importHar'),
            new TrafficGhostTreeItem(isRecording ? 'Stop Recording' : 'Start Browser Recording', vscode.TreeItemCollapsibleState.None, isRecording ? 'Stop CDP capture' : 'Capture browser traffic', isRecording ? 'debug-stop' : 'record', isRecording ? 'trafficghost.stopRecording' : 'trafficghost.startRecording'),
            new TrafficGhostTreeItem('Generate Mock API', vscode.TreeItemCollapsibleState.None, 'Analyze & build mocks', 'sparkle', 'trafficghost.generateMocks'),
            new TrafficGhostTreeItem(isRunning ? 'Stop Mock Server' : 'Start Mock Server', vscode.TreeItemCollapsibleState.None, isRunning ? `Running on :${this.serverManager.getPort()}` : 'Launch local server', isRunning ? 'debug-stop' : 'play', isRunning ? 'trafficghost.stopServer' : 'trafficghost.startServer'),
            new TrafficGhostTreeItem('Configure Scenario', vscode.TreeItemCollapsibleState.None, 'Latency / Errors / Empty', 'settings-gear', 'trafficghost.configureScenario'),
            new TrafficGhostTreeItem('Initialize Project', vscode.TreeItemCollapsibleState.None, 'Setup trafficghost/', 'folder-opened', 'trafficghost.initProject'),
            new TrafficGhostTreeItem('Clear Captured Data', vscode.TreeItemCollapsibleState.None, 'Reset recordings', 'trash', 'trafficghost.clearRecording')
        ];
        return Promise.resolve(items);
    }
}
exports.ActionsTreeProvider = ActionsTreeProvider;
class RestEndpointsTreeProvider {
    serverManager;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(serverManager) {
        this.serverManager = serverManager;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const schema = this.serverManager.getSchema();
        if (!schema || schema.restEndpoints.length === 0) {
            return Promise.resolve([
                new TrafficGhostTreeItem('No REST endpoints detected', vscode.TreeItemCollapsibleState.None, 'Import HAR or Record', 'info')
            ]);
        }
        const methodIcons = {
            GET: 'symbol-method',
            POST: 'plus',
            PUT: 'edit',
            PATCH: 'diff',
            DELETE: 'trash'
        };
        const items = schema.restEndpoints.map((ep) => {
            const icon = methodIcons[ep.method] || 'link';
            return new TrafficGhostTreeItem(`${ep.method} ${ep.pathPattern}`, vscode.TreeItemCollapsibleState.None, `${ep.requestCount} requests${ep.parameters.length > 0 ? ` (${ep.parameters.map((p) => p.name).join(', ')})` : ''}`, icon, 'trafficghost.openEndpoint', [ep.id]);
        });
        return Promise.resolve(items);
    }
}
exports.RestEndpointsTreeProvider = RestEndpointsTreeProvider;
class GraphQLEndpointsTreeProvider {
    serverManager;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(serverManager) {
        this.serverManager = serverManager;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const schema = this.serverManager.getSchema();
        if (!schema || schema.graphqlEndpoints.length === 0) {
            return Promise.resolve([
                new TrafficGhostTreeItem('No GraphQL operations detected', vscode.TreeItemCollapsibleState.None, 'Import HAR or Record', 'info')
            ]);
        }
        const items = schema.graphqlEndpoints.map((g) => {
            const icon = g.operationType === 'mutation' ? 'symbol-event' : 'symbol-field';
            return new TrafficGhostTreeItem(`${g.operationName}`, vscode.TreeItemCollapsibleState.None, `${g.operationType} (${g.requestCount} calls)`, icon, 'trafficghost.openEndpoint', [g.id]);
        });
        return Promise.resolve(items);
    }
}
exports.GraphQLEndpointsTreeProvider = GraphQLEndpointsTreeProvider;
class GhostSessionsTreeProvider {
    serverManager;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(serverManager) {
        this.serverManager = serverManager;
        this.serverManager.on('ghostModeChanged', () => this.refresh());
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const sessions = workspace_manager_1.WorkspaceManager.getInstance().loadGhostSessions();
        if (sessions.length === 0) {
            return Promise.resolve([
                new TrafficGhostTreeItem('No Ghost Sessions recorded', vscode.TreeItemCollapsibleState.None, 'Start a Ghost Session to begin', 'info')
            ]);
        }
        const activeSession = this.serverManager.getActiveGhostSession();
        const items = sessions.map((session) => {
            const isActive = activeSession && activeSession.id === session.id;
            return new TrafficGhostTreeItem(session.name, vscode.TreeItemCollapsibleState.None, `${isActive ? '★ Active' : ''} (${session.metadata.requestCount} reqs)`, isActive ? 'ghost' : 'history', 'trafficghost.openDashboard');
        });
        return Promise.resolve(items);
    }
}
exports.GhostSessionsTreeProvider = GhostSessionsTreeProvider;
//# sourceMappingURL=tree-view-provider.js.map