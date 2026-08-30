"use strict";
/**
 * API CodeLens Provider — displays inline actions and usage count above recognized endpoints in source code.
 *
 * Connected to:
 *   - src/extension.ts           (registered as vscode.CodeLensProvider)
 *   - src/server/server-manager.ts (getSchema() for endpoints lookup)
 */
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
exports.ApiCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
class ApiCodeLensProvider {
    serverManager;
    _onDidChangeCodeLenses = new vscode.EventEmitter();
    onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    constructor(serverManager) {
        this.serverManager = serverManager;
        this.serverManager.on('schemaChanged', () => this.refresh());
    }
    refresh() {
        this._onDidChangeCodeLenses.fire();
    }
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const schema = this.serverManager.getSchema();
        if (!schema || (schema.restEndpoints.length === 0 && schema.graphqlEndpoints.length === 0)) {
            return codeLenses;
        }
        const text = document.getText();
        // Check REST patterns
        for (const ep of schema.restEndpoints) {
            const cleanPattern = ep.pathPattern.replace(/:[a-zA-Z0-9]+/g, '');
            const segments = cleanPattern.split('/').filter(Boolean);
            if (segments.length === 0)
                continue;
            const basePath = '/' + segments.join('/');
            let index = text.indexOf(basePath);
            while (index !== -1) {
                const position = document.positionAt(index);
                const range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
                // Add CodeLens to start of the line containing the path
                const lineRange = new vscode.Range(position.line, 0, position.line, 0);
                codeLenses.push(new vscode.CodeLens(lineRange, {
                    title: `👻 TrafficGhost: View API Contract (${ep.method})`,
                    command: 'trafficghost.openEndpoint',
                    arguments: [ep.id]
                }));
                index = text.indexOf(basePath, index + 1);
            }
        }
        return codeLenses;
    }
}
exports.ApiCodeLensProvider = ApiCodeLensProvider;
//# sourceMappingURL=api-codelens-provider.js.map