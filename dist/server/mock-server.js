"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrafficGhostMockServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const events_1 = require("events");
const scenario_engine_1 = require("./scenario-engine");
const dynamic_handler_1 = require("./dynamic-handler");
const graphql_analyzer_1 = require("../analyzer/graphql-analyzer");
const output_channel_1 = require("../logging/output-channel");
class TrafficGhostMockServer extends events_1.EventEmitter {
    app;
    server = null;
    schema;
    config;
    isRunning = false;
    port;
    constructor(schema, config) {
        super();
        this.schema = schema;
        this.config = config;
        this.port = config.port || 4000;
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.registerRoutes();
    }
    updateSchema(schema) {
        this.schema = schema;
        // Recreate Express app and routes dynamically
        this.app = (0, express_1.default)();
        this.setupMiddleware();
        this.registerRoutes();
        output_channel_1.logger.info('Mock server routes reloaded with updated schema.');
    }
    updateConfig(config) {
        this.config = config;
    }
    setupMiddleware() {
        // 1. Enable CORS for all origins
        this.app.use((0, cors_1.default)({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
            allowedHeaders: ['*'],
            exposedHeaders: ['*']
        }));
        // 2. Request parsing
        this.app.use(express_1.default.json({ limit: '50mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
        this.app.use(express_1.default.text({ limit: '50mb' }));
    }
    registerRoutes() {
        // Health check endpoint for TrafficGhost UI
        this.app.get('/__trafficghost/health', (req, res) => {
            res.json({
                status: 'ok',
                version: this.config.version,
                globalScenario: this.config.globalScenario,
                restEndpointsCount: this.schema.restEndpoints.length,
                graphqlEndpointsCount: this.schema.graphqlEndpoints.length,
                port: this.port
            });
        });
        // 1. Register GraphQL Handlers
        this.registerGraphQLHandlers();
        // 2. Register REST Endpoints
        this.registerRestEndpoints();
        // 3. Fallback 404 handler for unmatched routes
        this.app.use(async (req, res) => {
            const startTime = Date.now();
            const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior(this.config.globalScenario, this.config.latency);
            await scenario_engine_1.ScenarioEngine.applyLatency(behavior.delayMs);
            const errBody = scenario_engine_1.ScenarioEngine.createErrorResponse(404, `Route ${req.method} ${req.path} not matched by any TrafficGhost mock endpoint.`);
            const eventData = {
                method: req.method,
                url: req.url,
                path: req.path,
                status: 404,
                durationMs: Date.now() - startTime,
                scenario: behavior.scenarioApplied,
                type: 'UNKNOWN',
                timestamp: Date.now()
            };
            this.emit('request', eventData);
            res.status(404).json({
                ...errBody,
                availableRestEndpoints: this.schema.restEndpoints.map((e) => `${e.method} ${e.pathPattern}`),
                availableGraphQLOperations: this.schema.graphqlEndpoints.map((g) => `${g.operationType} ${g.operationName}`)
            });
        });
    }
    registerGraphQLHandlers() {
        // Collect all unique GraphQL endpoint paths (defaulting to /graphql)
        const gqlPaths = Array.from(new Set(this.schema.graphqlEndpoints.map((g) => g.path).concat(['/graphql', '/api/graphql'])));
        for (const gqlPath of gqlPaths) {
            this.app.post(gqlPath, async (req, res, next) => {
                const startTime = Date.now();
                // Extract operation name from request body
                const reqMock = {
                    id: 'runtime',
                    method: 'POST',
                    url: req.originalUrl || req.url,
                    path: req.path,
                    query: req.query,
                    headers: req.headers,
                    body: req.body,
                    response: { status: 200, headers: {}, body: {} },
                    timestamp: Date.now()
                };
                const details = graphql_analyzer_1.GraphQLAnalyzer.extractOperationDetails(reqMock);
                const opName = details.operationName;
                // Find matching GraphQL endpoint definition
                const matchedDef = this.schema.graphqlEndpoints.find((g) => g.operationName.toLowerCase() === opName.toLowerCase()) || this.schema.graphqlEndpoints[0];
                const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior(this.config.globalScenario, this.config.latency, matchedDef);
                // Apply custom scenario headers
                for (const [hk, hv] of Object.entries(behavior.customHeaders || {})) {
                    res.setHeader(hk, hv);
                }
                // Apply simulated latency delay
                await scenario_engine_1.ScenarioEngine.applyLatency(behavior.delayMs);
                // Handle error scenarios
                if (behavior.statusCode >= 400) {
                    const errBody = scenario_engine_1.ScenarioEngine.createErrorResponse(behavior.statusCode);
                    const duration = Date.now() - startTime;
                    this.emitRequestEvent('POST', req.url, req.path, behavior.statusCode, duration, behavior.scenarioApplied, 'GRAPHQL', opName);
                    res.status(behavior.statusCode).json(errBody);
                    return;
                }
                // Handle empty scenario
                if (behavior.emptyPayload) {
                    const duration = Date.now() - startTime;
                    this.emitRequestEvent('POST', req.url, req.path, 200, duration, behavior.scenarioApplied, 'GRAPHQL', opName);
                    res.status(200).json({ data: {} });
                    return;
                }
                // Return matched response
                const responseBody = matchedDef ? matchedDef.defaultResponse.body : { data: {} };
                const duration = Date.now() - startTime;
                this.emitRequestEvent('POST', req.url, req.path, 200, duration, behavior.scenarioApplied, 'GRAPHQL', opName);
                res.status(200).json(responseBody);
            });
        }
    }
    registerRestEndpoints() {
        for (const endpoint of this.schema.restEndpoints) {
            const expressMethod = endpoint.method.toLowerCase();
            if (typeof this.app[expressMethod] !== 'function')
                continue;
            this.app[expressMethod](endpoint.pathPattern, async (req, res) => {
                const startTime = Date.now();
                const queryParams = {};
                for (const [k, v] of Object.entries(req.query)) {
                    queryParams[k] = Array.isArray(v) ? v.join(',') : String(v);
                }
                const pathParams = req.params;
                // 1. Evaluate behavior (scenario, error rate, latency)
                const behavior = scenario_engine_1.ScenarioEngine.evaluateBehavior(this.config.globalScenario, this.config.latency, endpoint);
                // 2. Set custom headers
                for (const [hk, hv] of Object.entries(behavior.customHeaders || {})) {
                    res.setHeader(hk, hv);
                }
                // 3. Apply latency delay
                await scenario_engine_1.ScenarioEngine.applyLatency(behavior.delayMs);
                // 4. Handle error scenarios
                if (behavior.statusCode >= 400) {
                    const errBody = scenario_engine_1.ScenarioEngine.createErrorResponse(behavior.statusCode);
                    const duration = Date.now() - startTime;
                    this.emitRequestEvent(req.method, req.url, req.path, behavior.statusCode, duration, behavior.scenarioApplied, 'REST');
                    res.status(behavior.statusCode).json(errBody);
                    return;
                }
                // 5. Select response variant based on query matching
                const variant = dynamic_handler_1.DynamicHandler.selectResponseVariant(endpoint, queryParams);
                // 6. Generate dynamic response (interpolate params & pagination)
                const finalBody = dynamic_handler_1.DynamicHandler.generateDynamicResponse(endpoint, pathParams, queryParams, variant.body, behavior.emptyPayload);
                // 7. Send headers from captured response
                if (variant.headers) {
                    for (const [hk, hv] of Object.entries(variant.headers)) {
                        if (['content-length', 'transfer-encoding', 'connection'].includes(hk.toLowerCase()))
                            continue;
                        try {
                            res.setHeader(hk, hv);
                        }
                        catch {
                            // ignore invalid headers
                        }
                    }
                }
                const finalStatus = behavior.statusCode || variant.statusCode || 200;
                const duration = Date.now() - startTime;
                this.emitRequestEvent(req.method, req.url, req.path, finalStatus, duration, behavior.scenarioApplied, 'REST');
                if (typeof finalBody === 'object' && finalBody !== null) {
                    res.status(finalStatus).json(finalBody);
                }
                else {
                    res.status(finalStatus).send(String(finalBody ?? ''));
                }
            });
        }
    }
    emitRequestEvent(method, url, path, status, durationMs, scenario, type, operationName) {
        const eventData = {
            method,
            url,
            path,
            status,
            durationMs,
            scenario,
            type,
            operationName,
            timestamp: Date.now()
        };
        this.emit('request', eventData);
        output_channel_1.logger.info(`[${type}] ${method} ${path} -> ${status} (${durationMs}ms) [Scenario: ${scenario}]`);
    }
    async start() {
        if (this.isRunning && this.server) {
            return this.port;
        }
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, () => {
                this.isRunning = true;
                output_channel_1.logger.info(`Mock server started successfully on http://localhost:${this.port}`);
                this.emit('started', { port: this.port });
                resolve(this.port);
            });
            this.server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    output_channel_1.logger.error(`Port ${this.port} is already in use. Please choose another port in settings.`);
                }
                else {
                    output_channel_1.logger.error(`Mock server failed to start: ${err.message}`, err);
                }
                this.isRunning = false;
                reject(err);
            });
        });
    }
    async stop() {
        if (!this.isRunning || !this.server) {
            this.isRunning = false;
            return;
        }
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                this.isRunning = false;
                this.server = null;
                if (err) {
                    output_channel_1.logger.error(`Error stopping mock server: ${err.message}`);
                    reject(err);
                }
                else {
                    output_channel_1.logger.info('Mock server stopped.');
                    this.emit('stopped');
                    resolve();
                }
            });
        });
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            routesCount: this.schema.restEndpoints.length + this.schema.graphqlEndpoints.length
        };
    }
}
exports.TrafficGhostMockServer = TrafficGhostMockServer;
//# sourceMappingURL=mock-server.js.map