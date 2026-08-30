import { CapturedRequest } from '../models/captured-request';
import {
  RestEndpointDefinition,
  GraphQLEndpointDefinition,
  TrafficGhostMockSchema,
  MockResponseVariant
} from '../models/endpoint';
import { RouteInferrer } from './route-inferrer';
import { QueryAnalyzer } from './query-analyzer';
import { GraphQLAnalyzer } from './graphql-analyzer';
import { logger } from '../logging/output-channel';

export class TrafficAnalyzer {
  /**
   * Performs full traffic analysis on an array of captured requests.
   */
  public static analyze(requests: CapturedRequest[]): TrafficGhostMockSchema {
    logger.info(`Analyzing ${requests.length} captured requests...`);

    const restRequests: CapturedRequest[] = [];
    const graphqlRequests: CapturedRequest[] = [];

    // 1. Separate REST vs GraphQL
    for (const req of requests) {
      if (GraphQLAnalyzer.isGraphQLRequest(req)) {
        graphqlRequests.push(req);
      } else {
        restRequests.push(req);
      }
    }

    logger.info(`Detected ${restRequests.length} REST requests and ${graphqlRequests.length} GraphQL requests.`);

    // 2. Analyze REST traffic
    const restEndpoints = TrafficAnalyzer.analyzeRest(restRequests);

    // 3. Analyze GraphQL traffic
    const graphqlEndpoints = GraphQLAnalyzer.analyzeGraphQL(graphqlRequests);

    logger.info(`Inferred ${restEndpoints.length} REST endpoints and ${graphqlEndpoints.length} GraphQL operations.`);

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      restEndpoints,
      graphqlEndpoints,
      globalScenario: 'normal'
    };
  }

  /**
   * Analyzes REST requests and groups them into parameterized endpoint definitions.
   */
  private static analyzeRest(requests: CapturedRequest[]): RestEndpointDefinition[] {
    // Group requests by HTTP Method
    const byMethod = new Map<string, CapturedRequest[]>();
    for (const req of requests) {
      const method = (req.method || 'GET').toUpperCase();
      if (!byMethod.has(method)) {
        byMethod.set(method, []);
      }
      byMethod.get(method)!.push(req);
    }

    const restEndpoints: RestEndpointDefinition[] = [];

    for (const [method, methodReqs] of byMethod.entries()) {
      const rawPaths = methodReqs.map((r) => r.path);
      const inferredRoutes = RouteInferrer.inferRoutes(rawPaths);

      for (const route of inferredRoutes) {
        // Find matching requests for this inferred route pattern
        const matchingReqs = methodReqs.filter((req) => route.rawPaths.includes(req.path));
        if (matchingReqs.length === 0) continue;

        // Analyze query params and pagination
        const { queryParams, pagination } = QueryAnalyzer.analyzeQueryParams(matchingReqs);

        // Build mock response variants
        const responseVariants: MockResponseVariant[] = [];
        for (let i = 0; i < matchingReqs.length; i++) {
          const mReq = matchingReqs[i];
          const queryStrMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(mReq.query)) {
            queryStrMap[k] = Array.isArray(v) ? v.join(',') : String(v);
          }

          responseVariants.push({
            id: `var_${i + 1}`,
            statusCode: mReq.response.status || 200,
            headers: mReq.response.headers || { 'content-type': 'application/json' },
            body: mReq.response.body !== undefined ? mReq.response.body : {},
            matchQuery: Object.keys(queryStrMap).length > 0 ? queryStrMap : undefined,
            matchBody: mReq.body !== undefined && mReq.body !== null && typeof mReq.body === 'object' && !Array.isArray(mReq.body)
              ? (mReq.body as Record<string, unknown>)
              : undefined,
            isDefault: i === 0
          });
        }

        const endpointId = `rest_${method.toLowerCase()}_${route.pattern.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;

        restEndpoints.push({
          id: endpointId,
          method: method as RestEndpointDefinition['method'],
          pathPattern: route.pattern,
          rawPaths: route.rawPaths,
          parameters: route.parameters,
          queryParameters: queryParams,
          responses: responseVariants,
          defaultResponse: responseVariants[0] || {
            id: 'default',
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: {},
            isDefault: true
          },
          pagination,
          requestCount: matchingReqs.length,
          sampleRequests: matchingReqs.map((r) => r.id)
        });
      }
    }

    // Sort endpoints nicely by path
    restEndpoints.sort((a, b) => a.pathPattern.localeCompare(b.pathPattern));
    return restEndpoints;
  }
}
