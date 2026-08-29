import { EventEmitter } from 'events';
import { TrafficGhostMockServer, ServerEventData } from './mock-server';
import { TrafficGhostMockSchema } from '../models/endpoint';
import { TrafficGhostConfig, DEFAULT_CONFIG } from '../models/config';
import { ScenarioType } from '../models/scenario';
import { logger } from '../logging/output-channel';

export class ServerManager extends EventEmitter {
  private static instance: ServerManager;
  private mockServer: TrafficGhostMockServer | null = null;
  private currentSchema: TrafficGhostMockSchema;
  private currentConfig: TrafficGhostConfig;
  private requestHistory: ServerEventData[] = [];

  private constructor() {
    super();
    this.currentConfig = { ...DEFAULT_CONFIG };
    this.currentSchema = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      restEndpoints: [],
      graphqlEndpoints: [],
      globalScenario: 'normal'
    };
  }

  public static getInstance(): ServerManager {
    if (!ServerManager.instance) {
      ServerManager.instance = new ServerManager();
    }
    return ServerManager.instance;
  }

  public setSchema(schema: TrafficGhostMockSchema): void {
    this.currentSchema = schema;
    if (this.mockServer) {
      this.mockServer.updateSchema(schema);
    }
    this.emit('schemaChanged', this.currentSchema);
  }

  public getSchema(): TrafficGhostMockSchema {
    return this.currentSchema;
  }

  public setConfig(config: TrafficGhostConfig): void {
    this.currentConfig = config;
    if (this.mockServer) {
      this.mockServer.updateConfig(config);
    }
    this.emit('configChanged', this.currentConfig);
  }

  public getConfig(): TrafficGhostConfig {
    return this.currentConfig;
  }

  public setGlobalScenario(scenario: ScenarioType): void {
    this.currentConfig.globalScenario = scenario;
    this.currentSchema.globalScenario = scenario;
    if (this.mockServer) {
      this.mockServer.updateConfig(this.currentConfig);
    }
    logger.info(`Switched global scenario to: ${scenario}`);
    this.emit('scenarioChanged', scenario);
  }

  public async startServer(port?: number): Promise<number> {
    if (port) {
      this.currentConfig.port = port;
    }

    if (this.mockServer && this.mockServer.getStatus().isRunning) {
      return this.currentConfig.port;
    }

    this.mockServer = new TrafficGhostMockServer(this.currentSchema, this.currentConfig);

    this.mockServer.on('request', (event: ServerEventData) => {
      this.requestHistory.unshift(event);
      if (this.requestHistory.length > 200) {
        this.requestHistory.pop();
      }
      this.emit('serverRequest', event);
    });

    this.mockServer.on('started', (info) => {
      this.emit('serverStarted', info);
    });

    this.mockServer.on('stopped', () => {
      this.emit('serverStopped');
    });

    const activePort = await this.mockServer.start();
    this.emit('stateChanged');
    return activePort;
  }

  public async stopServer(): Promise<void> {
    if (this.mockServer) {
      await this.mockServer.stop();
      this.mockServer = null;
      this.emit('stateChanged');
    }
  }

  public isRunning(): boolean {
    return this.mockServer ? this.mockServer.getStatus().isRunning : false;
  }

  public getPort(): number {
    return this.currentConfig.port;
  }

  public getRequestHistory(): ServerEventData[] {
    return [...this.requestHistory];
  }

  public clearRequestHistory(): void {
    this.requestHistory = [];
    this.emit('historyCleared');
  }
}
