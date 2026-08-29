"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLAnalyzer = void 0;
class GraphQLAnalyzer {
    /**
     * Checks if a captured request is a GraphQL operation.
     */
    static isGraphQLRequest(req) {
        const lowerPath = req.path.toLowerCase();
        if (lowerPath.endsWith('/graphql') || lowerPath.includes('/graphql/') || lowerPath.endsWith('/gql')) {
            return true;
        }
        if (req.contentType && req.contentType.includes('application/graphql')) {
            return true;
        }
        if (req.body && typeof req.body === 'object') {
            const bodyObj = req.body;
            if (typeof bodyObj.query === 'string' && (bodyObj.query.includes('query') || bodyObj.query.includes('mutation') || bodyObj.query.includes('{'))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Extracts GraphQL operation details from a request.
     */
    static extractOperationDetails(req) {
        let operationName = '';
        let operationType = 'query';
        let queryText = '';
        let variables = {};
        if (typeof req.body === 'object' && req.body !== null) {
            const bodyObj = req.body;
            if (typeof bodyObj.operationName === 'string' && bodyObj.operationName.trim()) {
                operationName = bodyObj.operationName.trim();
            }
            if (typeof bodyObj.query === 'string') {
                queryText = bodyObj.query.trim();
            }
            if (typeof bodyObj.variables === 'object' && bodyObj.variables !== null) {
                variables = bodyObj.variables;
            }
        }
        else if (typeof req.body === 'string') {
            queryText = req.body.trim();
        }
        // If operationName not in body, parse from queryText
        if (queryText) {
            // Check for mutation or subscription or query
            const match = queryText.match(/(query|mutation|subscription)\s+([a-zA-Z0-9_]+)/i);
            if (match) {
                operationType = match[1].toLowerCase();
                if (!operationName) {
                    operationName = match[2];
                }
            }
            else if (queryText.trim().startsWith('mutation')) {
                operationType = 'mutation';
            }
            else if (queryText.trim().startsWith('subscription')) {
                operationType = 'subscription';
            }
        }
        if (!operationName) {
            // Fallback name
            operationName = `Anonymous${operationType.charAt(0).toUpperCase() + operationType.slice(1)}`;
        }
        return { operationName, operationType, queryText, variables };
    }
    /**
     * Analyzes all captured GraphQL requests and creates GraphQLEndpointDefinitions.
     */
    static analyzeGraphQL(requests) {
        const operationsMap = new Map();
        for (const req of requests) {
            if (!GraphQLAnalyzer.isGraphQLRequest(req))
                continue;
            const details = GraphQLAnalyzer.extractOperationDetails(req);
            const key = `${req.path}::${details.operationName}`;
            if (!operationsMap.has(key)) {
                operationsMap.set(key, {
                    path: req.path,
                    operationName: details.operationName,
                    operationType: details.operationType,
                    queryText: details.queryText,
                    variablesList: [],
                    responses: [],
                    requestIds: []
                });
            }
            const entry = operationsMap.get(key);
            entry.requestIds.push(req.id);
            if (Object.keys(details.variables).length > 0) {
                entry.variablesList.push(details.variables);
            }
            const resVariant = {
                id: `gql_res_${entry.responses.length + 1}`,
                statusCode: req.response.status || 200,
                headers: { 'content-type': 'application/json' },
                body: req.response.body || { data: {} },
                isDefault: entry.responses.length === 0
            };
            entry.responses.push(resVariant);
        }
        const endpoints = [];
        for (const [_, op] of operationsMap.entries()) {
            endpoints.push({
                id: `gql_${op.operationName}_${Math.random().toString(36).substring(2, 7)}`,
                path: op.path,
                operationName: op.operationName,
                operationType: op.operationType,
                queryText: op.queryText,
                sampleVariables: op.variablesList,
                responses: op.responses,
                defaultResponse: op.responses[0] || {
                    id: 'default',
                    statusCode: 200,
                    headers: { 'content-type': 'application/json' },
                    body: { data: {} },
                    isDefault: true
                },
                requestCount: op.requestIds.length,
                sampleRequests: op.requestIds
            });
        }
        return endpoints;
    }
}
exports.GraphQLAnalyzer = GraphQLAnalyzer;
//# sourceMappingURL=graphql-analyzer.js.map