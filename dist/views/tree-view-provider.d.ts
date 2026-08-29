import * as vscode from 'vscode';
import { ServerManager } from '../server/server-manager';
import { BrowserRecorder } from '../recorder/browser-recorder';
export declare class TrafficGhostTreeItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly descriptionText?: string | undefined;
    readonly iconName?: string | undefined;
    readonly commandId?: string | undefined;
    readonly commandArgs?: any[] | undefined;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, descriptionText?: string | undefined, iconName?: string | undefined, commandId?: string | undefined, commandArgs?: any[] | undefined);
}
export declare class StatusTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
    private serverManager;
    private recorder;
    private getCapturedCount;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | TrafficGhostTreeItem | null | undefined>;
    constructor(serverManager: ServerManager, recorder: BrowserRecorder, getCapturedCount: () => number);
    refresh(): void;
    getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem;
    getChildren(): Thenable<TrafficGhostTreeItem[]>;
}
export declare class ActionsTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
    private serverManager;
    private recorder;
    constructor(serverManager: ServerManager, recorder: BrowserRecorder);
    getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem;
    getChildren(): Thenable<TrafficGhostTreeItem[]>;
}
export declare class RestEndpointsTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
    private serverManager;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | TrafficGhostTreeItem | null | undefined>;
    constructor(serverManager: ServerManager);
    refresh(): void;
    getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem;
    getChildren(): Thenable<TrafficGhostTreeItem[]>;
}
export declare class GraphQLEndpointsTreeProvider implements vscode.TreeDataProvider<TrafficGhostTreeItem> {
    private serverManager;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void | TrafficGhostTreeItem | null | undefined>;
    constructor(serverManager: ServerManager);
    refresh(): void;
    getTreeItem(element: TrafficGhostTreeItem): vscode.TreeItem;
    getChildren(): Thenable<TrafficGhostTreeItem[]>;
}
