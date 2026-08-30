/**
 * API CodeLens Provider — displays inline actions and usage count above recognized endpoints in source code.
 *
 * Connected to:
 *   - src/extension.ts           (registered as vscode.CodeLensProvider)
 *   - src/server/server-manager.ts (getSchema() for endpoints lookup)
 */
import * as vscode from 'vscode';
import { ServerManager } from '../server/server-manager';
export declare class ApiCodeLensProvider implements vscode.CodeLensProvider {
    private serverManager;
    private _onDidChangeCodeLenses;
    readonly onDidChangeCodeLenses: vscode.Event<void>;
    constructor(serverManager: ServerManager);
    refresh(): void;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]>;
}
