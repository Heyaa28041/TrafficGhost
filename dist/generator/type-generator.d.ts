/**
 * Generates TypeScript interfaces from actual response payloads (and request bodies if present).
 *
 * Connected to:
 *   - src/extension.ts (commands: generateTypes)
 *   - src/views/dashboard-panel.ts (webview interface requests)
 */
import { RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';
export interface GeneratedTypes {
    declarations: string;
    interfaces: string[];
    sourceEndpointId: string;
    sourceMethod: string;
    sourcePath: string;
}
export declare class TypeGenerator {
    static generateFromEndpoint(endpoint: RestEndpointDefinition | GraphQLEndpointDefinition): GeneratedTypes;
    private static formatName;
    private static generateForValue;
}
