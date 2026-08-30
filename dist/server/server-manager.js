"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerManager = void 0;
const events_1 = require("events");
const mock_server_1 = require("./mock-server");
const config_1 = require("../models/config");
const ghost_state_manager_1 = require("./ghost-state-manager");
const output_channel_1 = require("../logging/output-channel");
class ServerManager extends events_1.EventEmitter {
    static instance;
    mockServer = null;
    currentSchema;
    currentConfig;
    requestHistory = [];
    ghostMode = false;
    activeGhostSession = null;
    constructor() {
        super();
        this.currentConfig = { ...config_1.DEFAULT_CONFIG };
        this.currentSchema = {
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            restEndpoints: [],
            graphqlEndpoints: [],
            globalScenario: 'normal'
        };
    }
    static getInstance() {
        if (!ServerManager.instance) {
            ServerManager.instance = new ServerManager();
        }
        return ServerManager.instance;
    }
    setSchema(schema) {
        this.currentSchema = schema;
        if (this.mockServer) {
            this.mockServer.updateSchema(schema);
        }
        this.emit('schemaChanged', this.currentSchema);
    }
    getSchema() {
        return this.currentSchema;
    }
    setConfig(config) {
        this.currentConfig = config;
        if (this.mockServer) {
            this.mockServer.updateConfig(config);
        }
        this.emit('configChanged', this.currentConfig);
    }
    getConfig() {
        return this.currentConfig;
    }
    setGlobalScenario(scenario) {
        this.currentConfig.globalScenario = scenario;
        this.currentSchema.globalScenario = scenario;
        if (this.mockServer) {
            this.mockServer.updateConfig(this.currentConfig);
        }
        output_channel_1.logger.info(`Switched global scenario to: ${scenario}`);
        this.emit('scenarioChanged', scenario);
    }
    async startServer(port) {
        if (port) {
            this.currentConfig.port = port;
        }
        if (this.mockServer && this.mockServer.getStatus().isRunning) {
            return this.currentConfig.port;
        }
        this.mockServer = new mock_server_1.TrafficGhostMockServer(this.currentSchema, this.currentConfig);
        if (this.ghostMode) {
            this.mockServer.setGhostMode(true, ghost_state_manager_1.GhostStateManager.getInstance());
        }
        this.mockServer.on('request', (event) => {
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
    async stopServer() {
        if (this.mockServer) {
            await this.mockServer.stop();
            this.mockServer = null;
            this.emit('stateChanged');
        }
    }
    isRunning() {
        return this.mockServer ? this.mockServer.getStatus().isRunning : false;
    }
    getPort() {
        return this.currentConfig.port;
    }
    getRequestHistory() {
        return [...this.requestHistory];
    }
    clearRequestHistory() {
        this.requestHistory = [];
        this.emit('historyCleared');
    }
    enterGhostMode(session) {
        this.ghostMode = true;
        this.activeGhostSession = session;
        this.setSchema(session.schema);
        // Seed in-memory database state
        ghost_state_manager_1.GhostStateManager.getInstance().seedFromSchema(session.schema);
        if (this.mockServer) {
            this.mockServer.setGhostMode(true, ghost_state_manager_1.GhostStateManager.getInstance());
        }
        output_channel_1.logger.info(`Entered Ghost Mode with session: ${session.name}`);
        this.emit('ghostModeChanged', { enabled: true, session });
        this.emit('stateChanged');
    }
    exitGhostMode() {
        this.ghostMode = false;
        this.activeGhostSession = null;
        ghost_state_manager_1.GhostStateManager.getInstance().reset();
        if (this.mockServer) {
            this.mockServer.setGhostMode(false);
        }
        output_channel_1.logger.info('Exited Ghost Mode');
        this.emit('ghostModeChanged', { enabled: false });
        this.emit('stateChanged');
    }
    isGhostMode() {
        return this.ghostMode;
    }
    getActiveGhostSession() {
        return this.activeGhostSession;
    }
    getGhostState() {
        return ghost_state_manager_1.GhostStateManager.getInstance().getSnapshot();
    }
}
exports.ServerManager = ServerManager;
//# sourceMappingURL=server-manager.js.map