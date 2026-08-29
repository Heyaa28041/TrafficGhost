import { ScenarioRule, ScenarioType } from './scenario';

/**
 * Route parameter definition (e.g. :id, :productId)
 */
export interface RouteParameter {
  name: string;
  position: number; // 0-based path segment index
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
  itemsPath?: string; // JSON path to items array (e.g. 'items', 'users', 'products', or '' for top-level array)
  totalCountPath?: string;
  allCapturedItems?: unknown[]; // Aggregated items across captured pages
}

/**
 * REST Endpoint Definition
 */
export interface RestEndpointDefinition {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  pathPattern: string; // e.g. /api/users/:id
  rawPaths: string[]; // e.g. ['/api/users/1', '/api/users/2']
  parameters: RouteParameter[];
  queryParameters: QueryParameterDef[];
  responses: MockResponseVariant[];
  defaultResponse: MockResponseVariant;
  pagination?: PaginationConfig;
  requestCount: number;
  sampleRequests: string[]; // Request IDs

  // Behavior overrides
  scenarioRule?: ScenarioRule;
  latencyMin?: number;
  latencyMax?: number;
}

/**
 * GraphQL Endpoint & Operation Definition
 */
export interface GraphQLEndpointDefinition {
  id: string;
  path: string; // usually /graphql
  operationName: string;
  operationType: 'query' | 'mutation' | 'subscription';
  queryText?: string;
  sampleVariables: Record<string, unknown>[];
  responses: MockResponseVariant[];
  defaultResponse: MockResponseVariant;
  requestCount: number;
  sampleRequests: string[];

  // Behavior overrides
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
