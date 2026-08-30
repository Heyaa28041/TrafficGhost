/**
 * Scans the VS Code workspace line by line to detect where APIs are referenced.
 *
 * Connected to:
 *   - src/extension.ts (commands: findApiUsage, openApiUsage)
 *   - src/providers/api-hover-provider.ts (hover shows usages count)
 *   - src/providers/api-codelens-provider.ts (codelens shows usages)
 *   - src/views/dashboard-panel.ts (webview receives scanned usage map)
 */
import { TrafficGhostMockSchema } from '../models/endpoint';
export interface ApiUsageMatch {
    filePath: string;
    lineNumber: number;
    lineContent: string;
    confidence: 'CONFIRMED' | 'LIKELY' | 'POSSIBLE';
    usageType?: 'fetch' | 'axios' | 'wrapper' | 'other';
}
export interface ApiUsageResult {
    endpointId: string;
    method: string;
    pathPattern: string;
    usages: ApiUsageMatch[];
    lastScannedAt: string;
}
export declare class WorkspaceScanner {
    private static cache;
    static clearCache(): void;
    static getCached(endpointId: string): ApiUsageResult | null;
    /**
     * Scans all files in the workspace for references to this REST endpoint.
     */
    static scanForEndpoint(endpointId: string, method: string, pathPattern: string, workspaceRoot: string): Promise<ApiUsageResult>;
    /**
     * Scan all endpoints in a schema.
     */
    static scanAllEndpoints(schema: TrafficGhostMockSchema, workspaceRoot: string): Promise<ApiUsageResult[]>;
    private static scanDirRecursive;
}
