/**
 * API CodeLens Provider — displays inline actions and usage count above recognized endpoints in source code.
 *
 * Connected to:
 *   - src/extension.ts           (registered as vscode.CodeLensProvider)
 *   - src/server/server-manager.ts (getSchema() for endpoints lookup)
 */

import * as vscode from 'vscode';
import { ServerManager } from '../server/server-manager';

export class ApiCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor(private serverManager: ServerManager) {
    this.serverManager.on('schemaChanged', () => this.refresh());
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const schema = this.serverManager.getSchema();
    
    if (!schema || (schema.restEndpoints.length === 0 && schema.graphqlEndpoints.length === 0)) {
      return codeLenses;
    }

    const text = document.getText();
    
    // Check REST patterns
    for (const ep of schema.restEndpoints) {
      const cleanPattern = ep.pathPattern.replace(/:[a-zA-Z0-9]+/g, '');
      const segments = cleanPattern.split('/').filter(Boolean);
      if (segments.length === 0) continue;

      const basePath = '/' + segments.join('/');
      let index = text.indexOf(basePath);
      
      while (index !== -1) {
        const position = document.positionAt(index);
        const range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
        
        // Add CodeLens to start of the line containing the path
        const lineRange = new vscode.Range(position.line, 0, position.line, 0);
        
        codeLenses.push(
          new vscode.CodeLens(lineRange, {
            title: `👻 TrafficGhost: View API Contract (${ep.method})`,
            command: 'trafficghost.openEndpoint',
            arguments: [ep.id]
          })
        );
        
        index = text.indexOf(basePath, index + 1);
      }
    }

    return codeLenses;
  }
}
