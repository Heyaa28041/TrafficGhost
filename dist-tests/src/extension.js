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
const ghost_session_1 = require("./models/ghost-session");
const workspace_scanner_1 = require("./analyzer/workspace-scanner");
const contract_analyzer_1 = require("./analyzer/contract-analyzer");
const type_generator_1 = require("./generator/type-generator");
const client_generator_1 = require("./generator/client-generator");
const test_generator_1 = require("./generator/test-generator");
const documentation_generator_1 = require("./generator/documentation-generator");
const api_hover_provider_1 = require("./providers/api-hover-provider");
const api_codelens_provider_1 = require("./providers/api-codelens-provider");
const output_channel_1 = require("./logging/output-channel");
const integration_advisor_1 = require("./analyzer/integration-advisor");
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
    const ghostSessionsProvider = new tree_view_provider_1.GhostSessionsTreeProvider(serverManager);
    // Register Tree Views
    context.subscriptions.push(vscode.window.registerTreeDataProvider('trafficghost.statusView', statusProvider), vscode.window.registerTreeDataProvider('trafficghost.actionsView', actionsProvider), vscode.window.registerTreeDataProvider('trafficghost.restEndpointsView', restProvider), vscode.window.registerTreeDataProvider('trafficghost.graphqlOperationsView', gqlProvider), vscode.window.registerTreeDataProvider('trafficghost.ghostSessionsView', ghostSessionsProvider));
    // Register Language Feature Providers
    const languageSelector = [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'vue' }
    ];
    context.subscriptions.push(vscode.languages.registerHoverProvider(languageSelector, new api_hover_provider_1.ApiHoverProvider(serverManager)), vscode.languages.registerCodeLensProvider(languageSelector, new api_codelens_provider_1.ApiCodeLensProvider(serverManager)));
    // Helper to refresh all trees
    const refreshAllTrees = () => {
        statusProvider.refresh();
        restProvider.refresh();
        gqlProvider.refresh();
        ghostSessionsProvider.refresh();
    };
    const showFriendlyRecordingError = (err, prefix = 'Recording Error') => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Chrome executable not found')) {
            vscode.window.showErrorMessage('Chrome executable was not found on standard system paths. Please ensure Google Chrome is installed on your machine.', { modal: true });
        }
        else if (msg.includes('CDP unavailable')) {
            vscode.window.showErrorMessage('Chrome remote debugging port (9222) is not accessible. To fix this:\n' +
                '1. Close all running Google Chrome windows.\n' +
                '2. Open your terminal and start Chrome manually:\n' +
                '   - Windows: chrome.exe --remote-debugging-port=9222\n' +
                '   - macOS: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n' +
                '   - Linux: google-chrome --remote-debugging-port=9222', { modal: true });
        }
        else {
            vscode.window.showErrorMessage(`${prefix}: ${msg}`);
        }
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
            case 'startGhostSession':
                await vscode.commands.executeCommand('trafficghost.startGhostSession');
                break;
            case 'stopGhostSession':
                await vscode.commands.executeCommand('trafficghost.stopGhostSession');
                break;
            case 'enterGhostMode':
                await vscode.commands.executeCommand('trafficghost.enterGhostMode', data);
                break;
            case 'exitGhostMode':
                await vscode.commands.executeCommand('trafficghost.exitGhostMode');
                break;
            case 'deleteSession':
                await vscode.commands.executeCommand('trafficghost.deleteSession', data);
                break;
            case 'renameSession':
                await vscode.commands.executeCommand('trafficghost.renameSession', data);
                break;
            case 'generateTypes':
                await vscode.commands.executeCommand('trafficghost.generateTypes', data);
                break;
            case 'generateClient':
                await vscode.commands.executeCommand('trafficghost.generateClient', data);
                break;
            case 'generateTest':
                await vscode.commands.executeCommand('trafficghost.generateTest', data);
                break;
            case 'generateDocs':
                await vscode.commands.executeCommand('trafficghost.generateDocs');
                break;
            case 'diffContracts':
                await vscode.commands.executeCommand('trafficghost.diffContracts');
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
            showFriendlyRecordingError(err, 'Start Recording Failed');
            output_channel_1.logger.error(`Start recording error`, err);
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
            showFriendlyRecordingError(err, 'Stop Recording Failed');
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
    // 13. Command: Start Ghost Session
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.startGhostSession', async () => {
        try {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this Ghost Session',
                value: 'Shopping Flow',
                placeHolder: 'e.g. Shopping Flow'
            });
            if (!name)
                return;
            const targetUrl = await vscode.window.showInputBox({
                prompt: 'Enter target application URL to record',
                value: 'http://localhost:3000',
                placeHolder: 'http://localhost:3000'
            });
            if (targetUrl === undefined)
                return;
            // Clear captured data before starting session recording
            capturedRequestsStore = [];
            recorder.clearCaptured();
            await recorder.startRecording(targetUrl);
            refreshAllTrees();
            // Save active session name in workspace config temp space
            context.workspaceState.update('activeRecordingSessionName', name);
            vscode.window.showInformationMessage(`Ghost Session "${name}" recording started. Perform actions in browser, then stop recording.`);
        }
        catch (err) {
            showFriendlyRecordingError(err, 'Start Ghost Session Failed');
        }
    }));
    // 14. Command: Stop Ghost Session
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.stopGhostSession', async () => {
        try {
            const name = context.workspaceState.get('activeRecordingSessionName') || 'Recorded Session';
            const captured = await recorder.stopRecording();
            capturedRequestsStore = captured;
            if (captured.length === 0) {
                vscode.window.showWarningMessage('No network requests captured during the Ghost Session.');
                return;
            }
            const schema = traffic_analyzer_1.TrafficAnalyzer.analyze(captured);
            serverManager.setSchema(schema);
            // Build GhostSession object
            const sessionId = (0, ghost_session_1.generateSessionId)(name);
            const session = {
                id: sessionId,
                name,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                requests: captured,
                schema,
                metadata: {
                    requestCount: captured.length,
                    restEndpointCount: schema.restEndpoints.length,
                    graphqlEndpointCount: schema.graphqlEndpoints.length,
                    targetUrl: captured[0]?.url
                }
            };
            const root = workspaceManager.getWorkspaceRoot();
            if (root) {
                workspaceManager.saveGhostSession(session, root);
                mock_generator_1.MockGenerator.generateMockFiles(root, schema, serverManager.getConfig());
            }
            refreshAllTrees();
            const choice = await vscode.window.showInformationMessage(`Ghost Session "${name}" recorded: Discovered ${schema.restEndpoints.length} REST endpoints & ${schema.graphqlEndpoints.length} GraphQL operations.`, 'Enter Ghost Mode', 'Open Dashboard');
            if (choice === 'Enter Ghost Mode') {
                await vscode.commands.executeCommand('trafficghost.enterGhostMode', sessionId);
            }
            else if (choice === 'Open Dashboard') {
                await vscode.commands.executeCommand('trafficghost.openDashboard');
            }
        }
        catch (err) {
            showFriendlyRecordingError(err, 'Stop Ghost Session Failed');
        }
    }));
    // 15. Command: Enter Ghost Mode
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.enterGhostMode', async (sessionId) => {
        try {
            const root = workspaceManager.getWorkspaceRoot();
            let targetId = sessionId;
            if (!targetId) {
                const sessions = workspaceManager.loadGhostSessions(root);
                if (sessions.length === 0) {
                    vscode.window.showWarningMessage('No recorded Ghost Sessions found. Record a session first.');
                    return;
                }
                const selected = await vscode.window.showQuickPick(sessions.map(s => ({ label: s.name, id: s.id, description: `${s.metadata.requestCount} requests` })), { placeHolder: 'Select a Ghost Session to load as mock backend' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const session = workspaceManager.loadGhostSession(targetId, root);
            if (!session) {
                vscode.window.showErrorMessage(`Ghost Session with ID ${targetId} not found.`);
                return;
            }
            serverManager.enterGhostMode(session);
            refreshAllTrees();
            // Start server if not running
            if (!serverManager.isRunning()) {
                await vscode.commands.executeCommand('trafficghost.startServer');
            }
            vscode.window.showInformationMessage(`Ghost Mode activated with session: ${session.name}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Enter Ghost Mode Error: ${err}`);
        }
    }));
    // 16. Command: Exit Ghost Mode
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.exitGhostMode', () => {
        serverManager.exitGhostMode();
        refreshAllTrees();
        vscode.window.showInformationMessage('Ghost Mode deactivated. Switched back to normal mock schema.');
    }));
    // 17. Command: Delete Session
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.deleteSession', async (sessionId) => {
        try {
            const root = workspaceManager.getWorkspaceRoot();
            let targetId = sessionId;
            if (!targetId) {
                const sessions = workspaceManager.loadGhostSessions(root);
                if (sessions.length === 0)
                    return;
                const selected = await vscode.window.showQuickPick(sessions.map(s => ({ label: s.name, id: s.id })), { placeHolder: 'Select a session to delete' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const confirm = await vscode.window.showWarningMessage('Are you sure you want to delete this session?', 'Yes', 'No');
            if (confirm === 'Yes') {
                workspaceManager.deleteGhostSession(targetId, root);
                refreshAllTrees();
                vscode.window.showInformationMessage('Ghost Session deleted.');
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Delete Session Error: ${err}`);
        }
    }));
    // 18. Command: Rename Session
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.renameSession', async (sessionId) => {
        try {
            const root = workspaceManager.getWorkspaceRoot();
            let targetId = sessionId;
            if (!targetId) {
                const sessions = workspaceManager.loadGhostSessions(root);
                if (sessions.length === 0)
                    return;
                const selected = await vscode.window.showQuickPick(sessions.map(s => ({ label: s.name, id: s.id })), { placeHolder: 'Select a session to rename' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const newName = await vscode.window.showInputBox({ prompt: 'Enter new session name' });
            if (newName) {
                workspaceManager.renameGhostSession(targetId, newName, root);
                refreshAllTrees();
                vscode.window.showInformationMessage('Ghost Session renamed.');
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Rename Session Error: ${err}`);
        }
    }));
    // 19. Command: Generate Types
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateTypes', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to generate Types for' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId) || schema.graphqlEndpoints.find(g => g.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('Endpoint not found in active schema.');
                return;
            }
            const result = type_generator_1.TypeGenerator.generateFromEndpoint(endpoint);
            const doc = await vscode.workspace.openTextDocument({
                content: result.declarations,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(doc);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Generate Types Error: ${err}`);
        }
    }));
    // 20. Command: Generate Client Code
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateClient', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to generate client for' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('REST Endpoint not found in active schema.');
                return;
            }
            const root = workspaceManager.getWorkspaceRoot() || '';
            const result = client_generator_1.ClientGenerator.generateForEndpoint(endpoint, root);
            const doc = await vscode.workspace.openTextDocument({
                content: result.code,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(doc);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Generate Client Error: ${err}`);
        }
    }));
    // 21. Command: Generate Test Code
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateTest', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to generate tests for' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('REST Endpoint not found in active schema.');
                return;
            }
            const root = workspaceManager.getWorkspaceRoot() || '';
            const result = test_generator_1.TestGenerator.generateForEndpoint(endpoint, root);
            const doc = await vscode.workspace.openTextDocument({
                content: result.code,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(doc);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Generate Test Error: ${err}`);
        }
    }));
    // 22. Command: Generate API Docs
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateDocs', async () => {
        try {
            const schema = serverManager.getSchema();
            const result = documentation_generator_1.DocumentationGenerator.generateMarkdown(schema);
            const doc = await vscode.workspace.openTextDocument({
                content: result.markdown,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Generate Docs Error: ${err}`);
        }
    }));
    // 23. Command: Find API Usage
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.findApiUsage', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to scan for' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('REST Endpoint not found in active schema.');
                return;
            }
            const root = workspaceManager.getWorkspaceRoot() || '';
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Scanning workspace for ${endpoint.method} ${endpoint.pathPattern}...`
            }, async () => {
                const result = await workspace_scanner_1.WorkspaceScanner.scanForEndpoint(endpoint.id, endpoint.method, endpoint.pathPattern, root);
                if (result.usages.length === 0) {
                    vscode.window.showInformationMessage('No obvious usage of this API detected in workspace source files.');
                    return;
                }
                const usageItems = result.usages.map(u => ({
                    label: `${path.basename(u.filePath)}:${u.lineNumber}`,
                    description: u.lineContent,
                    detail: u.filePath,
                    match: u
                }));
                const picked = await vscode.window.showQuickPick(usageItems, { placeHolder: `Discovered ${result.usages.length} usages. Select to open:` });
                if (picked) {
                    const fileUri = vscode.Uri.file(picked.match.filePath);
                    const doc = await vscode.workspace.openTextDocument(fileUri);
                    const editor = await vscode.window.showTextDocument(doc);
                    const pos = new vscode.Position(picked.match.lineNumber - 1, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos));
                }
            });
        }
        catch (err) {
            vscode.window.showErrorMessage(`Find API Usage Error: ${err}`);
        }
    }));
    // 24. Command: Compare Session Contracts
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.diffContracts', async () => {
        try {
            const root = workspaceManager.getWorkspaceRoot();
            const sessions = workspaceManager.loadGhostSessions(root);
            if (sessions.length < 2) {
                vscode.window.showWarningMessage('Please capture at least two Ghost Sessions to run contract comparisons.');
                return;
            }
            const s1 = await vscode.window.showQuickPick(sessions.map(s => ({ label: s.name, id: s.id, session: s })), { placeHolder: 'Select old session version' });
            if (!s1)
                return;
            const s2 = await vscode.window.showQuickPick(sessions.map(s => ({ label: s.name, id: s.id, session: s })), { placeHolder: 'Select new session version' });
            if (!s2)
                return;
            const diff = contract_analyzer_1.ContractAnalyzer.compareSchemas(s1.session.schema, s2.session.schema);
            let report = `# API Contract Diff: ${s1.label} vs ${s2.label}\n\n`;
            report += `## Summary of Changes\n`;
            report += `- **Added endpoints:** ${diff.summary.added}\n`;
            report += `- **Removed endpoints:** ${diff.summary.removed}\n`;
            report += `- **Changed payload structures:** ${diff.summary.changed}\n`;
            report += `- **Breaking changes detected:** ${diff.summary.breaking}\n\n`;
            report += `## Detailed Changes\n`;
            for (const ed of diff.endpointDiffs) {
                if (ed.status === 'unchanged')
                    continue;
                report += `### \`${ed.method}\` ${ed.pathPattern} [Status: ${ed.status.toUpperCase()}]\n`;
                if (ed.potentiallyBreaking) {
                    report += `> ⚠️ **POTENTIALLY BREAKING CHANGE**\n\n`;
                }
                if (ed.fieldDiffs.length > 0) {
                    report += `| Field | Change Type | Old Type | New Type |\n`;
                    report += `| --- | --- | --- | --- |\n`;
                    for (const fd of ed.fieldDiffs) {
                        report += `| \`${fd.field}\` | ${fd.type} | \`${fd.oldType || '-'}\` | \`${fd.newType || '-'}\` |\n`;
                    }
                    report += '\n';
                }
            }
            const doc = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Diff Contracts Error: ${err}`);
        }
    }));
    // 24. Command: Generate Resilience Test
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateResilienceTest', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to generate resilience tests for' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('REST Endpoint not found in active schema.');
                return;
            }
            const root = workspaceManager.getWorkspaceRoot() || '';
            const result = test_generator_1.TestGenerator.generateResilienceTest(endpoint, root);
            const doc = await vscode.workspace.openTextDocument({
                content: result.code,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(doc);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Generate Resilience Test Error: ${err}`);
        }
    }));
    // 25. Command: Insert API Placeholder
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.insertApiPlaceholder', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to insert placeholder for' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('REST Endpoint not found in active schema.');
                return;
            }
            // Get candidate files from IntegrationAdvisor
            const root = workspaceManager.getWorkspaceRoot() || '';
            const suggestions = integration_advisor_1.IntegrationAdvisor.suggestLocations(endpoint.pathPattern, root);
            let filePath = '';
            if (suggestions.length > 0) {
                const items = suggestions.map(s => ({
                    label: path.basename(s.filePath),
                    description: s.reason,
                    detail: s.filePath,
                    filePath: s.filePath
                }));
                items.push({ label: 'Browse and select file manually...', description: '', detail: '', filePath: 'manual' });
                const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select target file to insert placeholder comment' });
                if (!picked)
                    return;
                if (picked.filePath === 'manual') {
                    const files = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false });
                    if (files && files[0]) {
                        filePath = files[0].fsPath;
                    }
                }
                else {
                    filePath = picked.filePath;
                }
            }
            else {
                // If no suggestions, let them choose manual file
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    title: 'Select source file to insert API placeholder'
                });
                if (files && files[0]) {
                    filePath = files[0].fsPath;
                }
            }
            if (!filePath)
                return;
            const commentText = `// TrafficGhost API integration\n// Endpoint: ${endpoint.method} ${endpoint.pathPattern}\n// TODO: Connect this component to the backend API.\n// Generated from captured TrafficGhost contract.\n\n`;
            const choice = await vscode.window.showWarningMessage(`Confirm inserting placeholder comment at top of ${path.basename(filePath)}?`, { modal: true, detail: `Proposed snippet:\n\n${commentText}` }, 'Insert Comment', 'Cancel');
            if (choice === 'Insert Comment') {
                const uri = vscode.Uri.file(filePath);
                const edit = new vscode.WorkspaceEdit();
                edit.insert(uri, new vscode.Position(0, 0), commentText);
                const success = await vscode.workspace.applyEdit(edit);
                if (success) {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await doc.save();
                    await vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage(`Successfully inserted API placeholder at top of ${path.basename(filePath)}.`);
                }
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Insert Placeholder Error: ${err}`);
        }
    }));
    // 26. Command: Generate API Integration
    context.subscriptions.push(vscode.commands.registerCommand('trafficghost.generateIntegration', async (endpointId) => {
        try {
            const schema = serverManager.getSchema();
            let targetId = endpointId;
            if (!targetId) {
                const items = schema.restEndpoints.map(e => ({ label: `${e.method} ${e.pathPattern}`, id: e.id, ep: e }));
                const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select endpoint to generate integration code' });
                if (!selected)
                    return;
                targetId = selected.id;
            }
            const endpoint = schema.restEndpoints.find(e => e.id === targetId);
            if (!endpoint) {
                vscode.window.showErrorMessage('REST Endpoint not found in active schema.');
                return;
            }
            const root = workspaceManager.getWorkspaceRoot() || '';
            const generated = client_generator_1.ClientGenerator.generateForEndpoint(endpoint, root);
            // Preview generated integration code in an unsaved text document first
            const doc = await vscode.workspace.openTextDocument({
                content: generated.code,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage(`Generated ${generated.style} client code for ${endpoint.method} ${endpoint.pathPattern}. Code is opened in preview editor for review.`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Generate Integration Error: ${err}`);
        }
    }));
    output_channel_1.logger.info('TrafficGhost extension successfully activated.');
}
function deactivate() {
    output_channel_1.logger.info('TrafficGhost extension deactivating...');
    return server_manager_1.ServerManager.getInstance().stopServer();
}
//# sourceMappingURL=extension.js.map