import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import cors from 'cors';
import { EventEmitter } from 'events';
import { TrafficGhostMockSchema, RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';
import { TrafficGhostConfig } from '../models/config';
import { ScenarioEngine, EvaluatedBehavior } from './scenario-engine';
import { DynamicHandler } from './dynamic-handler';
import { GraphQLAnalyzer } from '../analyzer/graphql-analyzer';
import { logger } from '../logging/output-channel';

export interface ServerEventData {
  method: string;
  url: string;
  path: string;
  status: number;
  durationMs: number;
  scenario: string;
  type: 'REST' | 'GRAPHQL' | 'UNKNOWN';
  operationName?: string;
  timestamp: number;
}

export class TrafficGhostMockServer extends EventEmitter {
  private app: express.Application;
  private server: http.Server | null = null;
  private schema: TrafficGhostMockSchema;
  private config: TrafficGhostConfig;
  private isRunning = false;
  private port: number;

  constructor(schema: TrafficGhostMockSchema, config: TrafficGhostConfig) {
    super();
    this.schema = schema;
    this.config = config;
    this.port = config.port || 4000;
    this.app = express();
    this.setupMiddleware();
    this.registerRoutes();
  }

  public updateSchema(schema: TrafficGhostMockSchema): void {
    this.schema = schema;
    // Recreate Express app and routes dynamically
    this.app = express();
    this.setupMiddleware();
    this.registerRoutes();
    logger.info('Mock server routes reloaded with updated schema.');
  }

  public updateConfig(config: TrafficGhostConfig): void {
    this.config = config;
  }

  private setupMiddleware(): void {
    // 1. Enable CORS for all origins
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: ['*'],
      exposedHeaders: ['*']
    }));

    // 2. Request parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(express.text({ limit: '50mb' }));
  }

  private registerRoutes(): void {
    // Health check endpoint for TrafficGhost UI
    this.app.get('/__trafficghost/health', (req: Request, res: Response) => {
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
    this.app.use(async (req: Request, res: Response) => {
      const startTime = Date.now();
      const behavior = ScenarioEngine.evaluateBehavior(
        this.config.globalScenario,
        this.config.latency
      );

      await ScenarioEngine.applyLatency(behavior.delayMs);

      const errBody = ScenarioEngine.createErrorResponse(
        404,
        `Route ${req.method} ${req.path} not matched by any TrafficGhost mock endpoint.`
      );

      const eventData: ServerEventData = {
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

  private registerGraphQLHandlers(): void {
    // Collect all unique GraphQL endpoint paths (defaulting to /graphql)
    const gqlPaths = Array.from(new Set(
      this.schema.graphqlEndpoints.map((g) => g.path).concat(['/graphql', '/api/graphql'])
    ));

    for (const gqlPath of gqlPaths) {
      this.app.post(gqlPath, async (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        // Extract operation name from request body
        const reqMock = {
          id: 'runtime',
          method: 'POST',
          url: req.originalUrl || req.url,
          path: req.path,
          query: req.query as Record<string, string>,
          headers: req.headers as Record<string, string>,
          body: req.body,
          response: { status: 200, headers: {}, body: {} },
          timestamp: Date.now()
        };

        const details = GraphQLAnalyzer.extractOperationDetails(reqMock);
        const opName = details.operationName;

        // Find matching GraphQL endpoint definition
        const matchedDef = this.schema.graphqlEndpoints.find(
          (g) => g.operationName.toLowerCase() === opName.toLowerCase()
        ) || this.schema.graphqlEndpoints[0];

        const behavior = ScenarioEngine.evaluateBehavior(
          this.config.globalScenario,
          this.config.latency,
          matchedDef
        );

        // Apply custom scenario headers
        for (const [hk, hv] of Object.entries(behavior.customHeaders || {})) {
          res.setHeader(hk, hv);
        }

        // Apply simulated latency delay
        await ScenarioEngine.applyLatency(behavior.delayMs);

        // Handle error scenarios
        if (behavior.statusCode >= 400) {
          const errBody = ScenarioEngine.createErrorResponse(behavior.statusCode);
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

  private registerRestEndpoints(): void {
    for (const endpoint of this.schema.restEndpoints) {
      const expressMethod = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
      if (typeof this.app[expressMethod] !== 'function') continue;

      this.app[expressMethod](endpoint.pathPattern, async (req: Request, res: Response) => {
        const startTime = Date.now();

        const queryParams: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.query)) {
          queryParams[k] = Array.isArray(v) ? (v as string[]).join(',') : String(v);
        }

        const pathParams = req.params as Record<string, string>;

        // 1. Evaluate behavior (scenario, error rate, latency)
        const behavior: EvaluatedBehavior = ScenarioEngine.evaluateBehavior(
          this.config.globalScenario,
          this.config.latency,
          endpoint
        );

        // 2. Set custom headers
        for (const [hk, hv] of Object.entries(behavior.customHeaders || {})) {
          res.setHeader(hk, hv);
        }

        // 3. Apply latency delay
        await ScenarioEngine.applyLatency(behavior.delayMs);

        // 4. Handle error scenarios
        if (behavior.statusCode >= 400) {
          const errBody = ScenarioEngine.createErrorResponse(behavior.statusCode);
          const duration = Date.now() - startTime;
          this.emitRequestEvent(req.method, req.url, req.path, behavior.statusCode, duration, behavior.scenarioApplied, 'REST');
          res.status(behavior.statusCode).json(errBody);
          return;
        }

        // 5. Select response variant based on query matching
        const variant = DynamicHandler.selectResponseVariant(endpoint, queryParams);

        // 6. Generate dynamic response (interpolate params & pagination)
        const finalBody = DynamicHandler.generateDynamicResponse(
          endpoint,
          pathParams,
          queryParams,
          variant.body,
          behavior.emptyPayload
        );

        // 7. Send headers from captured response
        if (variant.headers) {
          for (const [hk, hv] of Object.entries(variant.headers)) {
            if (['content-length', 'transfer-encoding', 'connection'].includes(hk.toLowerCase())) continue;
            try {
              res.setHeader(hk, hv);
            } catch {
              // ignore invalid headers
            }
          }
        }

        const finalStatus = behavior.statusCode || variant.statusCode || 200;
        const duration = Date.now() - startTime;
        this.emitRequestEvent(req.method, req.url, req.path, finalStatus, duration, behavior.scenarioApplied, 'REST');

        if (typeof finalBody === 'object' && finalBody !== null) {
          res.status(finalStatus).json(finalBody);
        } else {
          res.status(finalStatus).send(String(finalBody ?? ''));
        }
      });
    }
  }

  private emitRequestEvent(
    method: string,
    url: string,
    path: string,
    status: number,
    durationMs: number,
    scenario: string,
    type: 'REST' | 'GRAPHQL' | 'UNKNOWN',
    operationName?: string
  ): void {
    const eventData: ServerEventData = {
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
    logger.info(`[${type}] ${method} ${path} -> ${status} (${durationMs}ms) [Scenario: ${scenario}]`);
  }

  public async start(): Promise<number> {
    if (this.isRunning && this.server) {
      return this.port;
    }

    return new Promise<number>((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        this.isRunning = true;
        logger.info(`Mock server started successfully on http://localhost:${this.port}`);
        this.emit('started', { port: this.port });
        resolve(this.port);
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is already in use. Please choose another port in settings.`);
        } else {
          logger.error(`Mock server failed to start: ${err.message}`, err);
        }
        this.isRunning = false;
        reject(err);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      this.isRunning = false;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.server!.close((err) => {
        this.isRunning = false;
        this.server = null;
        if (err) {
          logger.error(`Error stopping mock server: ${err.message}`);
          reject(err);
        } else {
          logger.info('Mock server stopped.');
          this.emit('stopped');
          resolve();
        }
      });
    });
  }

  public getStatus(): { isRunning: boolean; port: number; routesCount: number } {
    return {
      isRunning: this.isRunning,
      port: this.port,
      routesCount: this.schema.restEndpoints.length + this.schema.graphqlEndpoints.length
    };
  }
}
