/**
 * Suggests likely files in the workspace where an unintegrated API should be placed.
 *
 * Connected to:
 *   - src/extension.ts           — commands (integration gap check)
 *   - src/views/dashboard-panel.ts — passes advice to Dashboard Webview
 */
export interface IntegrationSuggestion {
    filePath: string;
    reason: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
export declare class IntegrationAdvisor {
    /**
     * Suggests possible locations for integrating an endpoint.
     */
    static suggestLocations(pathPattern: string, workspaceRoot: string): IntegrationSuggestion[];
    private static collectSourceFiles;
}
