"use strict";
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
exports.ApiHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
const workspace_scanner_1 = require("../analyzer/workspace-scanner");
class ApiHoverProvider {
    serverManager;
    constructor(serverManager) {
        this.serverManager = serverManager;
    }
    provideHover(document, position) {
        const schema = this.serverManager.getSchema();
        if (!schema || (schema.restEndpoints.length === 0 && schema.graphqlEndpoints.length === 0)) {
            return undefined;
        }
        // Get the word range and full line
        const lineText = document.lineAt(position.line).text;
        // Try to find a REST endpoint match on this line
        for (const ep of schema.restEndpoints) {
            const segments = ep.pathPattern.split('/').filter(Boolean).filter(s => !s.startsWith(':'));
            if (segments.length === 0)
                continue;
            // Check if the significant path segments appear in this line
            const basePath = '/' + segments.join('/');
            if (lineText.includes(ep.pathPattern) || lineText.includes(basePath)) {
                return this.buildRestHover(ep);
            }
        }
        // Try GraphQL operations
        for (const gql of schema.graphqlEndpoints) {
            if (lineText.includes(gql.operationName)) {
                return this.buildGraphQLHover(gql);
            }
        }
        return undefined;
    }
    buildRestHover(ep) {
        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
        // Header
        md.appendMarkdown(`**TrafficGhost** — API Contract\n\n`);
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`\`${ep.method} ${ep.pathPattern}\`\n\n`);
        // Observed status codes
        const statusCodes = [...new Set(ep.responses.map(r => r.statusCode))].sort();
        md.appendMarkdown(`**Observed Status Codes:** ${statusCodes.join(', ')}\n\n`);
        // Request count
        md.appendMarkdown(`**Captured:** ${ep.requestCount} request${ep.requestCount !== 1 ? 's' : ''}\n\n`);
        // Parameters
        if (ep.parameters.length > 0) {
            md.appendMarkdown(`**Path Parameters:** ${ep.parameters.map(p => `:${p.name} (${p.inferredType})`).join(', ')}\n\n`);
        }
        if (ep.queryParameters.length > 0) {
            const nonPagination = ep.queryParameters.filter(q => !q.isPagination);
            if (nonPagination.length > 0) {
                md.appendMarkdown(`**Query Params:** ${nonPagination.map(q => q.name).join(', ')}\n\n`);
            }
        }
        // Average latency from timing data
        const avgLatency = this.computeAvgLatency(ep);
        if (avgLatency > 0) {
            md.appendMarkdown(`**Observed Latency:** ~${avgLatency}ms avg\n\n`);
        }
        // Response preview (first 3 keys of default response body)
        const body = ep.defaultResponse?.body;
        if (body && typeof body === 'object' && !Array.isArray(body)) {
            const keys = Object.keys(body).slice(0, 4);
            if (keys.length > 0) {
                md.appendMarkdown(`**Response Fields:** \`${keys.join('`, `')}\`\n\n`);
            }
        }
        else if (Array.isArray(body) && body.length > 0) {
            const item = body[0];
            if (item && typeof item === 'object') {
                const keys = Object.keys(item).slice(0, 4);
                if (keys.length > 0) {
                    md.appendMarkdown(`**Item Fields:** \`${keys.join('`, `')}\`\n\n`);
                }
            }
        }
        // Action links
        md.appendMarkdown(`---\n`);
        const cachedScan = workspace_scanner_1.WorkspaceScanner.getCached(ep.id);
        if (cachedScan) {
            md.appendMarkdown(`**Frontend Usages:** ${cachedScan.usages.length} references\n\n`);
        }
        else {
            md.appendMarkdown(`**Frontend Usages:** Not scanned yet\n\n`);
        }
        md.appendMarkdown(`[View Contract](command:trafficghost.openEndpoint?${encodeURIComponent(JSON.stringify([ep.id]))}) · `);
        md.appendMarkdown(`[Find Usages](command:trafficghost.findApiUsage?${encodeURIComponent(JSON.stringify([ep.id]))}) · `);
        md.appendMarkdown(`[Generate Types](command:trafficghost.generateTypes?${encodeURIComponent(JSON.stringify([ep.id]))})`);
        return new vscode.Hover(md);
    }
    buildGraphQLHover(gql) {
        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;
        md.appendMarkdown(`**TrafficGhost** — GraphQL Operation\n\n`);
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`\`${gql.operationType.toUpperCase()} ${gql.operationName}\`\n\n`);
        md.appendMarkdown(`**Endpoint:** \`${gql.path}\`\n\n`);
        md.appendMarkdown(`**Captured:** ${gql.requestCount} call${gql.requestCount !== 1 ? 's' : ''}\n\n`);
        if (gql.queryText) {
            md.appendMarkdown(`**Query:**\n\`\`\`graphql\n${gql.queryText.substring(0, 200)}${gql.queryText.length > 200 ? '...' : ''}\n\`\`\`\n\n`);
        }
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`[View Contract](command:trafficghost.openEndpoint?${encodeURIComponent(JSON.stringify([gql.id]))})`);
        return new vscode.Hover(md);
    }
    computeAvgLatency(ep) {
        // Use request count as proxy — we don't have per-request timing in schema
        // This is intentionally not fabricated: return 0 if no timing data
        return 0;
    }
}
exports.ApiHoverProvider = ApiHoverProvider;
//# sourceMappingURL=api-hover-provider.js.map