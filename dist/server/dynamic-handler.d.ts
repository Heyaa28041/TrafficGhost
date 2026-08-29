import { RestEndpointDefinition, MockResponseVariant } from '../models/endpoint';
export declare class DynamicHandler {
    /**
     * Selects the best matching response variant based on request query parameters.
     */
    static selectResponseVariant(endpoint: RestEndpointDefinition, requestQuery: Record<string, string>): MockResponseVariant;
    /**
     * Generates a realistic dynamic response by replacing path parameters and applying pagination.
     */
    static generateDynamicResponse(endpoint: RestEndpointDefinition, pathParams: Record<string, string>, queryParams: Record<string, string>, baseBody: unknown, emptyPayload?: boolean): unknown;
    /**
     * Recursively replaces ID / parameter fields with the requested path parameter values.
     */
    static interpolatePathParameters(obj: unknown, params: Record<string, string>): unknown;
    /**
     * Dynamically slices and computes paginated response items and counts.
     */
    static applyPagination(body: unknown, endpoint: RestEndpointDefinition, queryParams: Record<string, string>): unknown;
    private static extractItemsArray;
    private static generateSyntheticItem;
    private static generateEmptyPayload;
}
