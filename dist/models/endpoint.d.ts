import { ScenarioRule, ScenarioType } from './scenario';
/**
 * Route parameter definition (e.g. :id, :productId)
 */
export interface RouteParameter {
    name: string;
    position: number;
    inferredType: 'number' | 'uuid' | 'string';
    sampleValues: string[];
}
/**
 * Query parameter definition (e.g. page, limit, filter)
 */
export interface QueryParameterDef {
    name: string;
    isPagination: boolean;
    paginationType?: 'page' | 'pageSize' | 'limit' | 'offset' | 'cursor';
    sampleValues: string[];
}
/**
 * Mock response item representing captured responses
 */
export interface MockResponseVariant {
    id: string;
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    matchQuery?: Record<string, string>;
    matchBody?: Record<string, unknown>;
    isDefault?: boolean;
}
/**
 * Pagination metadata for an endpoint that supports paginated responses
 */
export interface PaginationConfig {
    enabled: boolean;
    pageParam?: string;
    pageSizeParam?: string;
    limitParam?: string;
    offsetParam?: string;
    cursorParam?: string;
    itemsPath?: string;
    totalCountPath?: string;
    allCapturedItems?: unknown[];
}
/**
 * REST Endpoint Definition
 */
export interface RestEndpointDefinition {
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
    pathPattern: string;
    rawPaths: string[];
    parameters: RouteParameter[];
    queryParameters: QueryParameterDef[];
    responses: MockResponseVariant[];
    defaultResponse: MockResponseVariant;
    pagination?: PaginationConfig;
    requestCount: number;
    sampleRequests: string[];
    scenarioRule?: ScenarioRule;
    latencyMin?: number;
    latencyMax?: number;
}
/**
 * GraphQL Endpoint & Operation Definition
 */
export interface GraphQLEndpointDefinition {
    id: string;
    path: string;
    operationName: string;
    operationType: 'query' | 'mutation' | 'subscription';
    queryText?: string;
    sampleVariables: Record<string, unknown>[];
    responses: MockResponseVariant[];
    defaultResponse: MockResponseVariant;
    requestCount: number;
    sampleRequests: string[];
    scenarioRule?: ScenarioRule;
    latencyMin?: number;
    latencyMax?: number;
}
/**
 * Analyzed Mock Definition Schema saved to disk
 */
export interface TrafficGhostMockSchema {
    version: string;
    generatedAt: string;
    sourceFiles?: string[];
    restEndpoints: RestEndpointDefinition[];
    graphqlEndpoints: GraphQLEndpointDefinition[];
    globalScenario: ScenarioType;
}
