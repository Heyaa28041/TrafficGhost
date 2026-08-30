/**
 * API Hover Provider — shows API contract info when hovering over API calls in source code.
 *
 * Connects to:
 *   - src/extension.ts           (registered as vscode.HoverProvider)
 *   - src/server/server-manager.ts (getSchema() for endpoint lookup)
 *   - src/analyzer/workspace-scanner.ts (usage count in hover)
 *
 * Registers for: .ts, .tsx, .js, .jsx, .vue files.
 * Activates when cursor is over a string containing a known API path.
 */
import * as vscode from 'vscode';
import { ServerManager } from '../server/server-manager';
export declare class ApiHoverProvider implements vscode.HoverProvider {
    private serverManager;
    constructor(serverManager: ServerManager);
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined;
    private buildRestHover;
    private buildGraphQLHover;
    private computeAvgLatency;
}
