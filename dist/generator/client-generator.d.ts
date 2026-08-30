/**
 * Generates API client code based on the endpoint contract.
 * Automatically adapts style (fetch vs axios) based on workspace configuration.
 *
 * Connected to:
 *   - src/extension.ts (commands: generateClient)
 *   - src/views/dashboard-panel.ts (webview panel messages)
 */
import { RestEndpointDefinition } from '../models/endpoint';
export type ClientStyle = 'fetch' | 'axios';
export interface GeneratedClient {
    code: string;
    style: ClientStyle;
    functionName: string;
    sourceEndpointId: string;
}
export declare class ClientGenerator {
    static detectClientStyle(workspaceRoot: string): ClientStyle;
    static generateForEndpoint(endpoint: RestEndpointDefinition, workspaceRoot: string): GeneratedClient;
    private static getFunctionName;
}
