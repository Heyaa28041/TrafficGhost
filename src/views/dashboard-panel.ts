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

export class TrafficGhostDashboardPanel {
  public static currentPanel: TrafficGhostDashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

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
      TrafficGhostDashboardPanel.currentPanel.syncState();
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

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

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
    serverManager.on('stateChanged', () => this.syncState());
    serverManager.on('serverRequest', () => this.syncState());
    serverManager.on('scenarioChanged', () => this.syncState());
    serverManager.on('schemaChanged', () => this.syncState());
    recorder.on('captured', () => this.syncState());
    recorder.on('started', () => this.syncState());
    recorder.on('stopped', () => this.syncState());
  }

  public selectEndpoint(endpointId: string): void {
    this._panel.webview.postMessage({
      type: 'SELECT_ENDPOINT',
      endpointId
    });
  }

  public syncState(): void {
    if (!this._panel.visible) return;

    const schema = this.serverManager.getSchema();
    const config = this.serverManager.getConfig();
    const isRunning = this.serverManager.isRunning();
    const isRecording = this.recorder.getIsRecording();
    const captured = this.getCapturedRequests();
    const history = this.serverManager.getRequestHistory();
    const framework = WorkspaceManager.getInstance().detectFrontendFramework();

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

  private async handleWebviewMessage(message: { type: string; payload?: any }): Promise<void> {
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
        this.serverManager.setGlobalScenario(payload.scenario as ScenarioType);
        WorkspaceManager.getInstance().saveConfig(this.serverManager.getConfig());
        this.syncState();
        break;

      case 'UPDATE_CONFIG':
        const updatedConfig = { ...this.serverManager.getConfig(), ...payload.config };
        this.serverManager.setConfig(updatedConfig);
        WorkspaceManager.getInstance().saveConfig(updatedConfig);
        this.syncState();
        break;

      case 'UPDATE_REST_ENDPOINT':
        const schema = this.serverManager.getSchema();
        const epIndex = schema.restEndpoints.findIndex((e) => e.id === payload.endpoint.id);
        if (epIndex >= 0) {
          schema.restEndpoints[epIndex] = payload.endpoint;
          this.serverManager.setSchema(schema);
          WorkspaceManager.getInstance().saveSchema(schema);
        }
        this.syncState();
        break;

      case 'UPDATE_GRAPHQL_ENDPOINT':
        const gSchema = this.serverManager.getSchema();
        const gIndex = gSchema.graphqlEndpoints.findIndex((g) => g.id === payload.endpoint.id);
        if (gIndex >= 0) {
          gSchema.graphqlEndpoints[gIndex] = payload.endpoint;
          this.serverManager.setSchema(gSchema);
          WorkspaceManager.getInstance().saveSchema(gSchema);
        }
        this.syncState();
        break;

      case 'CLEAR_HISTORY':
        this.serverManager.clearRequestHistory();
        this.syncState();
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
