import * as vscode from 'vscode';
import { ServerManager } from '../server/server-manager';
import { BrowserRecorder } from '../recorder/browser-recorder';
import { RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';

export class TrafficGhostTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly descriptionText?: string,
    public readonly iconName?: string,
    public readonly commandId?: string,
    public readonly commandArgs?: any[]
  ) {
    super(label, collapsibleState);
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

export class StatusTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TrafficGhostTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private serverManager: ServerManager,
    private recorder: BrowserRecorder,
    private getCapturedCount: () => number
  ) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<TrafficGhostTreeItem[]> {
    const isRecording = this.recorder.getIsRecording();
    const isServerRunning = this.serverManager.isRunning();
    const port = this.serverManager.getPort();
    const schema = this.serverManager.getSchema();
    const scenario = this.serverManager.getConfig().globalScenario;
    const capturedCount = this.getCapturedCount();

    const items: TrafficGhostTreeItem[] = [
      new TrafficGhostTreeItem(
        'Recording',
        vscode.TreeItemCollapsibleState.None,
        isRecording ? '● Active' : '● Inactive',
        isRecording ? 'record' : 'circle-slash',
        'trafficghost.openDashboard'
      ),
      new TrafficGhostTreeItem(
        'Captured Traffic',
        vscode.TreeItemCollapsibleState.None,
        `${capturedCount} requests`,
        'arrow-swap',
        'trafficghost.openDashboard'
      ),
      new TrafficGhostTreeItem(
        'REST Endpoints',
        vscode.TreeItemCollapsibleState.None,
        `${schema.restEndpoints.length} endpoints`,
        'symbol-interface',
        'trafficghost.openDashboard'
      ),
      new TrafficGhostTreeItem(
        'GraphQL Operations',
        vscode.TreeItemCollapsibleState.None,
        `${schema.graphqlEndpoints.length} operations`,
        'symbol-method',
        'trafficghost.openDashboard'
      ),
      new TrafficGhostTreeItem(
        'Mock Server',
        vscode.TreeItemCollapsibleState.None,
        isServerRunning ? `● Running (: ${port})` : 'Stopped',
        isServerRunning ? 'server-process' : 'server',
        'trafficghost.openDashboard'
      ),
      new TrafficGhostTreeItem(
        'Active Scenario',
        vscode.TreeItemCollapsibleState.None,
        scenario.toUpperCase(),
        'gear',
        'trafficghost.configureScenario'
      )
    ];

    return Promise.resolve(items);
  }
}

export class ActionsTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
  constructor(
    private serverManager: ServerManager,
    private recorder: BrowserRecorder
  ) {}

  getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<TrafficGhostTreeItem[]> {
    const isRecording = this.recorder.getIsRecording();
    const isRunning = this.serverManager.isRunning();

    const items: TrafficGhostTreeItem[] = [
      new TrafficGhostTreeItem(
        'Open Traffic Dashboard',
        vscode.TreeItemCollapsibleState.None,
        'Webview UI',
        'dashboard',
        'trafficghost.openDashboard'
      ),
      new TrafficGhostTreeItem(
        'Import HAR File',
        vscode.TreeItemCollapsibleState.None,
        'Load .har capture',
        'file-code',
        'trafficghost.importHar'
      ),
      new TrafficGhostTreeItem(
        isRecording ? 'Stop Recording' : 'Start Browser Recording',
        vscode.TreeItemCollapsibleState.None,
        isRecording ? 'Stop CDP capture' : 'Capture browser traffic',
        isRecording ? 'debug-stop' : 'record',
        isRecording ? 'trafficghost.stopRecording' : 'trafficghost.startRecording'
      ),
      new TrafficGhostTreeItem(
        'Generate Mock API',
        vscode.TreeItemCollapsibleState.None,
        'Analyze & build mocks',
        'sparkle',
        'trafficghost.generateMocks'
      ),
      new TrafficGhostTreeItem(
        isRunning ? 'Stop Mock Server' : 'Start Mock Server',
        vscode.TreeItemCollapsibleState.None,
        isRunning ? `Running on :${this.serverManager.getPort()}` : 'Launch local server',
        isRunning ? 'debug-stop' : 'play',
        isRunning ? 'trafficghost.stopServer' : 'trafficghost.startServer'
      ),
      new TrafficGhostTreeItem(
        'Configure Scenario',
        vscode.TreeItemCollapsibleState.None,
        'Latency / Errors / Empty',
        'settings-gear',
        'trafficghost.configureScenario'
      ),
      new TrafficGhostTreeItem(
        'Initialize Project',
        vscode.TreeItemCollapsibleState.None,
        'Setup trafficghost/',
        'folder-opened',
        'trafficghost.initProject'
      ),
      new TrafficGhostTreeItem(
        'Clear Captured Data',
        vscode.TreeItemCollapsibleState.None,
        'Reset recordings',
        'trash',
        'trafficghost.clearRecording'
      )
    ];

    return Promise.resolve(items);
  }
}

export class RestEndpointsTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TrafficGhostTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private serverManager: ServerManager) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<TrafficGhostTreeItem[]> {
    const schema = this.serverManager.getSchema();
    if (!schema || schema.restEndpoints.length === 0) {
      return Promise.resolve([
        new TrafficGhostTreeItem(
          'No REST endpoints detected',
          vscode.TreeItemCollapsibleState.None,
          'Import HAR or Record',
          'info'
        )
      ]);
    }

    const methodIcons: Record<string, string> = {
      GET: 'symbol-method',
      POST: 'plus',
      PUT: 'edit',
      PATCH: 'diff',
      DELETE: 'trash'
    };

    const items = schema.restEndpoints.map((ep) => {
      const icon = methodIcons[ep.method] || 'link';
      return new TrafficGhostTreeItem(
        `${ep.method} ${ep.pathPattern}`,
        vscode.TreeItemCollapsibleState.None,
        `${ep.requestCount} requests${ep.parameters.length > 0 ? ` (${ep.parameters.map((p) => p.name).join(', ')})` : ''}`,
        icon,
        'trafficghost.openEndpoint',
        [ep.id]
      );
    });

    return Promise.resolve(items);
  }
}

export class GraphQLEndpointsTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TrafficGhostTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private serverManager: ServerManager) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<TrafficGhostTreeItem[]> {
    const schema = this.serverManager.getSchema();
    if (!schema || schema.graphqlEndpoints.length === 0) {
      return Promise.resolve([
        new TrafficGhostTreeItem(
          'No GraphQL operations detected',
          vscode.TreeItemCollapsibleState.None,
          'Import HAR or Record',
          'info'
        )
      ]);
    }

    const items = schema.graphqlEndpoints.map((g) => {
      const icon = g.operationType === 'mutation' ? 'symbol-event' : 'symbol-field';
      return new TrafficGhostTreeItem(
        `${g.operationName}`,
        vscode.TreeItemCollapsibleState.None,
        `${g.operationType} (${g.requestCount} calls)`,
        icon,
        'trafficghost.openEndpoint',
        [g.id]
      );
    });

    return Promise.resolve(items);
  }
}
