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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const har_parser_1 = require("./parser/har-parser");
const traffic_analyzer_1 = require("./analyzer/traffic-analyzer");
const mock_generator_1 = require("./generator/mock-generator");
const server_manager_1 = require("./server/server-manager");
const browser_recorder_1 = require("./recorder/browser-recorder");
const workspace_manager_1 = require("./storage/workspace-manager");
const dashboard_panel_1 = require("./views/dashboard-panel");
const tree_view_provider_1 = require("./views/tree-view-provider");
const scenario_1 = require("./models/scenario");
const output_channel_1 = require("./logging/output-channel");
let capturedRequestsStore = [];
function activate(context) {
    output_channel_1.logger.info('TrafficGhost extension is activating...');
    const serverManager = server_manager_1.ServerManager.getInstance();
    const workspaceManager = workspace_manager_1.WorkspaceManager.getInstance();
    const recorder = new browser_recorder_1.BrowserRecorder();
    // Load existing config & schema if project was previously initialized
    const savedConfig = workspaceManager.loadConfig();
    serverManager.setConfig(savedConfig);
    const savedSchema = workspaceManager.loadSchema();
    if (savedSchema) {
        serverManager.setSchema(savedSchema);
        output_channel_1.logger.info(`Loaded ${savedSchema.restEndpoints.length} REST endpoints and ${savedSchema.graphqlEndpoints.length} GraphQL operations from workspace.`);
    }
    // Tree Providers
    const statusProvider = new tree_view_provider_1.StatusTreeProvider(serverManager, recorder, () => capturedRequestsStore.length);
    const actionsProvider = new tree_view_provider_1.ActionsTreeProvider(serverManager, recorder);
    const restProvider = new tree_view_provider_1.RestEndpointsTreeProvider(serverManager);
    const gqlProvider = new tree_view_provider_1.GraphQLEndpointsTreeProvider(serverManager);
    // Register Tree Views
    context.subscriptions.push(vscode.window.registerTreeDataProvider('trafficghost.statusView', statusProvider), vscode.window.registerTreeDataProvider('trafficghost.actionsView', actionsProvider), vscode.window.registerTreeDataProvider('trafficghost.restEndpointsView', restProvider), vscode.window.registerTreeDataProvider('trafficghost.graphqlOperationsView', gqlProvider));
    // Helper to refresh all trees
    const refreshAllTrees = () => {
        statusProvider.refresh();
        restProvider.refresh();
        gqlProvider.refresh();
    };
    serverManager.on('stateChanged', refreshAllTrees);
    serverManager.on('schemaChanged', refreshAllTrees);
    serverManager.on('scenarioChanged', refreshAllTrees);
    recorder.on('captured', () => {
        capturedRequestsStore = recorder.getCapturedRequests();
        refreshAllTrees();
    });
    recorder.on('started', refreshAllTrees);
    recorder.on('stopped', refreshAllTrees);
    // Webview Action Handler
    const handleDashboardAction = async (action, data) => {
        switch (action) {
            case 'startServer':
                await vscode.commands.executeCommand('trafficghost.startServer');
                break;
            case 'stopServer':
                await vscode.commands.executeCommand('trafficghost.stopServer');
                break;
            case 'importHar':
                await vscode.commands.executeCommand('trafficghost.importHar');
                break;
            case 'startRecording':
                await vscode.commands.executeCommand('trafficghost.startRecording');
                break;
            case 'stopRecording':
                await vscode.commands.executeCommand('trafficghost.stopRecording');
                break;
            case 'generateMocks':
                await vscode.commands.executeCommand('trafficghost.generateMocks');
                break;
        }
    };
    // 1. Command: Initialize Project
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.initProject', async () => {
        try {
            const res = workspaceManager.initializeProject();
            vscode.window.showInformationMessage(`TrafficGhost initialized successfully in: ${res.configPath}`);
            output_channel_1.logger.info(`Initialized project. Created .env.trafficghost and trafficghost/ directory.`);
            refreshAllTrees();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to initialize TrafficGhost: ${msg}`);
            output_channel_1.logger.error(`Init failed: ${msg}`);
        }
    }));
    // 2. Command: Import HAR
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.importHar', async (fileUri) => {
        try {
            let uri = fileUri;
            if (!uri) {
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'HTTP Archive (.har)': ['har'], 'All Files': ['*'] },
                    title: 'Select HAR file to import'
                });
                if (!files || files.length === 0)
                    return;
                uri = files[0];
            }
            const rawData = fs.readFileSync(uri.fsPath, 'utf-8');
            output_channel_1.logger.info(`Importing HAR file: ${uri.fsPath}`);
            const config = serverManager.getConfig();
            const parsedRequests = har_parser_1.HarParser.parse(rawData, config.redactHeaders);
            capturedRequestsStore = parsedRequests;
            output_channel_1.logger.info(`Captured ${parsedRequests.length} requests from HAR.`);
            // Analyze Traffic
            const schema = traffic_analyzer_1.TrafficAnalyzer.analyze(parsedRequests);
            serverManager.setSchema(schema);
            // Save recording & mocks to workspace
            const root = workspaceManager.getWorkspaceRoot();
            if (root) {
                workspaceManager.saveRecording(parsedRequests, root);
                mock_generator_1.MockGenerator.generateMockFiles(root, schema, config);
            }
            refreshAllTrees();
            const selection = await vscode.window.showInformationMessage(`TrafficGhost analyzed HAR: Discovered ${schema.restEndpoints.length} REST endpoints & ${schema.graphqlEndpoints.length} GraphQL operations.`, 'Start Mock Server', 'Open Dashboard');
            if (selection === 'Start Mock Server') {
                await vscode.commands.executeCommand('trafficghost.startServer');
            }
            else if (selection === 'Open Dashboard') {
                await vscode.commands.executeCommand('trafficghost.openDashboard');
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`HAR Import Error: ${msg}`);
            output_channel_1.logger.error(`HAR Import failed: ${msg}`, err);
        }
    }));
    // 3. Command: Start Browser Recording
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.startRecording', async () => {
        try {
            const targetUrl = await vscode.window.showInputBox({
                prompt: 'Enter target application URL to record (or leave default)',
                value: 'http://localhost:3000',
                placeHolder: 'http://localhost:3000'
            });
            if (targetUrl === undefined)
                return; // cancelled
            await recorder.startRecording(targetUrl);
            refreshAllTrees();
            vscode.window.showInformationMessage(`TrafficGhost browser recording started on ${targetUrl}. Perform actions in the browser, then click Stop Recording.`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Browser Recording Error: ${msg}`);
            output_channel_1.logger.error(`Start recording error: ${msg}`, err);
        }
    }));
    // 4. Command: Stop Browser Recording
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.stopRecording', async () => {
        try {
            const captured = await recorder.stopRecording();
            capturedRequestsStore = captured;
            if (captured.length > 0) {
                const schema = traffic_analyzer_1.TrafficAnalyzer.analyze(captured);
                serverManager.setSchema(schema);
                const root = workspaceManager.getWorkspaceRoot();
                if (root) {
                    workspaceManager.saveRecording(captured, root);
                    mock_generator_1.MockGenerator.generateMockFiles(root, schema, serverManager.getConfig());
                }
                refreshAllTrees();
                vscode.window.showInformationMessage(`Recorded ${captured.length} requests. Generated ${schema.restEndpoints.length} REST endpoints and ${schema.graphqlEndpoints.length} GraphQL operations.`);
            }
            else {
                vscode.window.showWarningMessage('No network requests captured during the recording session.');
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Stop Recording Error: ${msg}`);
        }
    }));
    // 5. Command: Analyze Traffic
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.analyzeTraffic', () => {
        if (capturedRequestsStore.length === 0) {
            vscode.window.showWarningMessage('No captured traffic to analyze. Please import a HAR or record browser interactions first.');
            return;
        }
        const schema = traffic_analyzer_1.TrafficAnalyzer.analyze(capturedRequestsStore);
        serverManager.setSchema(schema);
        refreshAllTrees();
        vscode.window.showInformationMessage(`Analysis complete: ${schema.restEndpoints.length} REST endpoints, ${schema.graphqlEndpoints.length} GraphQL operations.`);
    }));
    // 6. Command: Generate Mock API
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateMocks', () => {
        const root = workspaceManager.getWorkspaceRoot();
        const schema = serverManager.getSchema();
        const config = serverManager.getConfig();
        if (!root) {
            vscode.window.showErrorMessage('No active workspace folder found. Please open a folder in VS Code first.');
            return;
        }
        mock_generator_1.MockGenerator.generateMockFiles(root, schema, config);
        vscode.window.showInformationMessage(`Mock API files generated in ${path.join(root, 'trafficghost')}`);
    }));
    // 7. Command: Start Mock Server
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.startServer', async () => {
        try {
            const port = serverManager.getPort();
            const activePort = await serverManager.startServer(port);
            refreshAllTrees();
            vscode.window.showInformationMessage(`TrafficGhost Mock Server running at http://localhost:${activePort}`);
            output_channel_1.logger.info(`Mock server listening on port ${activePort}`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to start mock server: ${msg}`);
        }
    }));
    // 8. Command: Stop Mock Server
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.stopServer', async () => {
        await serverManager.stopServer();
        refreshAllTrees();
        vscode.window.showInformationMessage('TrafficGhost Mock Server stopped.');
    }));
    // 9. Command: Open Dashboard
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.openDashboard', () => {
        dashboard_panel_1.TrafficGhostDashboardPanel.createOrShow(context.extensionUri, serverManager, recorder, () => capturedRequestsStore, handleDashboardAction);
    }));
    // 10. Command: Open Specific Endpoint
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.openEndpoint', (endpointId) => {
        const panel = dashboard_panel_1.TrafficGhostDashboardPanel.createOrShow(context.extensionUri, serverManager, recorder, () => capturedRequestsStore, handleDashboardAction);
        if (endpointId) {
            panel.selectEndpoint(endpointId);
        }
    }));
    // 11. Command: Configure Scenario
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.configureScenario', async () => {
        const scenarioItems = Object.entries(scenario_1.BUILTIN_SCENARIOS).map(([key, def]) => ({
            label: def.name,
            description: def.description,
            scenarioKey: key
        }));
        const selected = await vscode.window.showQuickPick(scenarioItems, {
            placeHolder: 'Select active simulation scenario for mock server responses'
        });
        if (selected) {
            serverManager.setGlobalScenario(selected.scenarioKey);
            workspaceManager.saveConfig(serverManager.getConfig());
            refreshAllTrees();
            vscode.window.showInformationMessage(`TrafficGhost scenario set to: ${selected.label}`);
        }
    }));
    // 12. Command: Clear Recording
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.clearRecording', async () => {
        const choice = await vscode.window.showWarningMessage('Are you sure you want to clear all captured traffic and recorded requests?', 'Yes, Clear', 'Cancel');
        if (choice === 'Yes, Clear') {
            capturedRequestsStore = [];
            recorder.clearCaptured();
            refreshAllTrees();
            vscode.window.showInformationMessage('Captured traffic cleared.');
        }
    }));
    output_channel_1.logger.info('TrafficGhost extension successfully activated.');
}
function deactivate() {
    output_channel_1.logger.info('TrafficGhost extension deactivating...');
    return server_manager_1.ServerManager.getInstance().stopServer();
}
//# sourceMappingURL=extension.js.map