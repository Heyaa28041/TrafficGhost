import { CapturedRequest } from '../models/captured-request';
import { GraphQLEndpointDefinition } from '../models/endpoint';
export declare class GraphQLAnalyzer {
    /**
     * Checks if a captured request is a GraphQL operation.
     */
    static isGraphQLRequest(req: CapturedRequest): boolean;
    /**
     * Extracts GraphQL operation details from a request.
     */
    static extractOperationDetails(req: CapturedRequest): {
        operationName: string;
        operationType: 'query' | 'mutation' | 'subscription';
        queryText: string;
        variables: Record<string, unknown>;
    };
    /**
     * Analyzes all captured GraphQL requests and creates GraphQLEndpointDefinitions.
     */
    static analyzeGraphQL(requests: CapturedRequest[]): GraphQLEndpointDefinition[];
}
