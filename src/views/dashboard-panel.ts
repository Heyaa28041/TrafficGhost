import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ServerManager } from '../server/server-manager';
import { BrowserRecorder } from '../recorder/browser-recorder';
import { WorkspaceManager } from '../storage/workspace-manager';
import { CapturedRequest } from '../models/captured-request';
import { TrafficGhostMockSchema, RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';
import { ScenarioType } from '../models/scenario';
import { logger } from '../logging/output-channel';
import { WorkspaceScanner } from '../analyzer/workspace-scanner';
import { IntegrationAdvisor } from '../analyzer/integration-advisor';
import { ResilienceAnalyzer } from '../analyzer/resilience-analyzer';
import { detectSensitiveData } from '../models/captured-request';

export class TrafficGhostDashboardPanel {
  public static currentPanel: TrafficGhostDashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private disposed = false;

  public static createOrShow(
    extensionUri: vscode.Uri,
    serverManager: ServerManager,
    recorder: BrowserRecorder,
    getCapturedRequests: () => CapturedRequest[],
    onAction: (action: string, data?: any) => Promise<void>
  ): TrafficGhostDashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TrafficGhostDashboardPanel.currentPanel) {
      TrafficGhostDashboardPanel.currentPanel._panel.reveal(column);
      TrafficGhostDashboardPanel.currentPanel.syncStateSafely();
      return TrafficGhostDashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'trafficGhostDashboard',
      'TrafficGhost Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'src', 'webview')
        ]
      }
    );

    TrafficGhostDashboardPanel.currentPanel = new TrafficGhostDashboardPanel(
      panel,
      extensionUri,
      serverManager,
      recorder,
      getCapturedRequests,
      onAction
    );

    return TrafficGhostDashboardPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private serverManager: ServerManager,
    private recorder: BrowserRecorder,
    private getCapturedRequests: () => CapturedRequest[],
    private onAction: (action: string, data?: any) => Promise<void>
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this.updateWebviewContent();

    this._panel.onDidDispose(() => {
      this.disposed = true;
      TrafficGhostDashboardPanel.currentPanel = undefined;
      this.disposeListeners();
    }, null, this._disposables);

    // Listen to messages from Webview UI
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          await this.handleWebviewMessage(message);
        } catch (err) {
          logger.error(`Error handling webview message: ${err}`);
        }
      },
      null,
      this._disposables
    );

    // Listen to server events
    const syncState = () => {
      this.syncStateSafely();
    };
    const serverEvents = ['stateChanged', 'serverRequest', 'scenarioChanged', 'schemaChanged'] as const;
    for (const event of serverEvents) {
      serverManager.on(event, syncState);
      this._disposables.push(new vscode.Disposable(() => serverManager.removeListener(event, syncState)));
    }
    const recorderEvents = ['captured', 'started', 'stopped'] as const;
    for (const event of recorderEvents) {
      recorder.on(event, syncState);
      this._disposables.push(new vscode.Disposable(() => recorder.removeListener(event, syncState)));
    }
  }

  public selectEndpoint(endpointId: string): void {
    if (this.disposed) return;

    this._panel.webview.postMessage({
      type: 'SELECT_ENDPOINT',
      endpointId
    });
  }

  public async syncState(): Promise<void> {
    if (this.disposed || !this._panel.visible) return;

    const schema = this.serverManager.getSchema();
    const config = this.serverManager.getConfig();
    const isRunning = this.serverManager.isRunning();
    const isRecording = this.recorder.getIsRecording();
    const captured = this.getCapturedRequests();
    const history = this.serverManager.getRequestHistory();
    const framework = WorkspaceManager.getInstance().detectFrontendFramework();
    const sessions = WorkspaceManager.getInstance().loadGhostSessions();
    const isGhostMode = this.serverManager.isGhostMode();
    const activeGhostSession = this.serverManager.getActiveGhostSession();

    const root = WorkspaceManager.getInstance().getWorkspaceRoot() || '';
    
    // 1. Scan results mapping
    const scanResults = root && schema ? await WorkspaceScanner.scanAllEndpoints(schema, root) : [];
    if (this.disposed) return;

    // 2. Integration advisor mapping & Resilience analyzer mapping
    const integrationAdvice: Record<string, any[]> = {};
    const resilienceReports: Record<string, any> = {};
    let integratedCount = 0;

    if (schema) {
      for (const ep of schema.restEndpoints || []) {
        const scan = scanResults.find(r => r.endpointId === ep.id);
        const usages = scan ? scan.usages : [];
        if (usages.length > 0) {
          integratedCount++;
          resilienceReports[ep.id] = ResilienceAnalyzer.analyzeUsages(usages);
        } else {
          integrationAdvice[ep.id] = root ? IntegrationAdvisor.suggestLocations(ep.pathPattern, root) : [];
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
    const performanceInsights: Record<string, { avg: number; min: number; max: number; count: number }> = {};
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
      if (detectSensitiveData(req)) {
        sensitiveDataWarning = true;
        break;
      }
    }

    if (this.disposed) return;

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

  private syncStateSafely(): void {
    if (this.disposed) return;

    void this.syncState().catch((err) => {
      logger.error(`Error syncing dashboard state: ${err}`);
    });
  }

  private async handleWebviewMessage(message: { type: string; payload?: any }): Promise<void> {
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
        this.serverManager.setGlobalScenario(payload.scenario as ScenarioType);
        WorkspaceManager.getInstance().saveConfig(this.serverManager.getConfig());
        await this.syncState();
        break;

      case 'UPDATE_CONFIG':
        const updatedConfig = { ...this.serverManager.getConfig(), ...payload.config };
        this.serverManager.setConfig(updatedConfig);
        WorkspaceManager.getInstance().saveConfig(updatedConfig);
        await this.syncState();
        break;

      case 'UPDATE_REST_ENDPOINT':
        const schema = this.serverManager.getSchema();
        const epIndex = schema.restEndpoints.findIndex((e) => e.id === payload.endpoint.id);
        if (epIndex >= 0) {
          schema.restEndpoints[epIndex] = payload.endpoint;
          this.serverManager.setSchema(schema);
          WorkspaceManager.getInstance().saveSchema(schema);
        }
        await this.syncState();
        break;

      case 'UPDATE_GRAPHQL_ENDPOINT':
        const gSchema = this.serverManager.getSchema();
        const gIndex = gSchema.graphqlEndpoints.findIndex((g) => g.id === payload.endpoint.id);
        if (gIndex >= 0) {
          gSchema.graphqlEndpoints[gIndex] = payload.endpoint;
          this.serverManager.setSchema(gSchema);
          WorkspaceManager.getInstance().saveSchema(gSchema);
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
        logger.warn(`Unknown webview message type: ${type}`);
    }
  }

  private updateWebviewContent(): void {
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

  public dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    TrafficGhostDashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    this.disposeListeners();
  }

  private disposeListeners(): void {
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
