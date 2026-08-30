/**
 * Generates markdown documentation for API schemas based on captured endpoint metrics.
 *
 * Connected to:
 *   - src/extension.ts (commands: generateDocs)
 */
import { TrafficGhostMockSchema } from '../models/endpoint';
export interface GeneratedDocs {
    markdown: string;
    endpointCount: number;
    graphqlCount: number;
    generatedAt: string;
}
export declare class DocumentationGenerator {
    static generateMarkdown(schema: TrafficGhostMockSchema): GeneratedDocs;
    private static formatRestEndpoint;
    private static formatGraphQLEndpoint;
    private static formatBody;
}
