import * as vscode from 'vscode';
import { ServerManager } from '../server/server-manager';
import { BrowserRecorder } from '../recorder/browser-recorder';
import { CapturedRequest } from '../models/captured-request';
export declare class TrafficGhostDashboardPanel {
    private serverManager;
    private recorder;
    private getCapturedRequests;
    private onAction;
    static currentPanel: TrafficGhostDashboardPanel | undefined;
    private readonly _panel;
    private readonly _extensionUri;
    private _disposables;
    private disposed;
    static createOrShow(extensionUri: vscode.Uri, serverManager: ServerManager, recorder: BrowserRecorder, getCapturedRequests: () => CapturedRequest[], onAction: (action: string, data?: any) => Promise<void>): TrafficGhostDashboardPanel;
    private constructor();
    selectEndpoint(endpointId: string): void;
    syncState(): Promise<void>;
    private syncStateSafely;
    private handleWebviewMessage;
    private updateWebviewContent;
    dispose(): void;
    private disposeListeners;
}
