"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const config_1 = require("../models/config");
const scenario_1 = require("../models/scenario");
const output_channel_1 = require("../logging/output-channel");
let vscodeModule = null;
try {
    vscodeModule = require('vscode');
}
catch {
    vscodeModule = null;
}
class WorkspaceManager {
    static instance;
    constructor() { }
    static getInstance() {
        if (!WorkspaceManager.instance) {
            WorkspaceManager.instance = new WorkspaceManager();
        }
        return WorkspaceManager.instance;
    }
    getWorkspaceRoot() {
        try {
            if (vscodeModule && vscodeModule.workspace && vscodeModule.workspace.workspaceFolders) {
                const folders = vscodeModule.workspace.workspaceFolders;
                if (folders && folders.length > 0) {
                    return folders[0].uri.fsPath;
                }
            }
        }
        catch {
            // ignore
        }
        return process.cwd();
    }
    getTrafficGhostDir(rootPath) {
        const root = rootPath || this.getWorkspaceRoot() || process.cwd();
        return path.join(root, 'trafficghost');
    }
    isProjectInitialized(rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const configPath = path.join(tgDir, 'config.json');
        return fs.existsSync(configPath);
    }
    initializeProject(rootPath) {
        const root = rootPath || this.getWorkspaceRoot() || process.cwd();
        const tgDir = path.join(root, 'trafficghost');
        const mocksDir = path.join(tgDir, 'mocks');
        const recordingsDir = path.join(tgDir, 'recordings');
        const scenariosDir = path.join(tgDir, 'scenarios');
        [tgDir, mocksDir, recordingsDir, scenariosDir].forEach((dir) => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
        const configPath = path.join(tgDir, 'config.json');
        const schemaPath = path.join(tgDir, 'schema.json');
        const scenariosPath = path.join(scenariosDir, 'scenarios.json');
        const envPath = path.join(root, '.env.trafficghost');
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(config_1.DEFAULT_CONFIG, null, 2), 'utf-8');
        }
        if (!fs.existsSync(scenariosPath)) {
            fs.writeFileSync(scenariosPath, JSON.stringify(scenario_1.BUILTIN_SCENARIOS, null, 2), 'utf-8');
        }
        const initialSchema = {
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            restEndpoints: [],
            graphqlEndpoints: [],
            globalScenario: 'normal'
        };
        if (!fs.existsSync(schemaPath)) {
            fs.writeFileSync(schemaPath, JSON.stringify(initialSchema, null, 2), 'utf-8');
        }
        const envContent = `# TrafficGhost Local Mock Server Environment
# Point your frontend API calls to TrafficGhost:
VITE_API_URL=http://localhost:4000
REACT_APP_API_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
API_BASE_URL=http://localhost:4000
TRAFFICGHOST_URL=http://localhost:4000
`;
        if (!fs.existsSync(envPath)) {
            fs.writeFileSync(envPath, envContent, 'utf-8');
        }
        output_channel_1.logger.info(`Initialized TrafficGhost project structure in ${tgDir}`);
        return { configPath, schemaPath, envPath };
    }
    saveRecording(requests, rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const recordingsDir = path.join(tgDir, 'recordings');
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(recordingsDir, `capture_${timestamp}.json`);
        fs.writeFileSync(filePath, JSON.stringify(requests, null, 2), 'utf-8');
        output_channel_1.logger.info(`Saved ${requests.length} requests to ${filePath}`);
        return filePath;
    }
    loadConfig(rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const configPath = path.join(tgDir, 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const raw = fs.readFileSync(configPath, 'utf-8');
                return JSON.parse(raw);
            }
            catch (err) {
                output_channel_1.logger.error(`Error loading config from ${configPath}`, err);
            }
        }
        return { ...config_1.DEFAULT_CONFIG };
    }
    saveConfig(config, rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        if (!fs.existsSync(tgDir)) {
            fs.mkdirSync(tgDir, { recursive: true });
        }
        const configPath = path.join(tgDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    loadSchema(rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const schemaPath = path.join(tgDir, 'schema.json');
        if (fs.existsSync(schemaPath)) {
            try {
                const raw = fs.readFileSync(schemaPath, 'utf-8');
                return JSON.parse(raw);
            }
            catch (err) {
                output_channel_1.logger.error(`Error loading schema from ${schemaPath}`, err);
            }
        }
        return null;
    }
    saveSchema(schema, rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const mocksDir = path.join(tgDir, 'mocks');
        if (!fs.existsSync(mocksDir)) {
            fs.mkdirSync(mocksDir, { recursive: true });
        }
        const schemaPath = path.join(tgDir, 'schema.json');
        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
        const restPath = path.join(mocksDir, 'rest.json');
        fs.writeFileSync(restPath, JSON.stringify(schema.restEndpoints, null, 2), 'utf-8');
        const gqlPath = path.join(mocksDir, 'graphql.json');
        fs.writeFileSync(gqlPath, JSON.stringify(schema.graphqlEndpoints, null, 2), 'utf-8');
    }
    detectFrontendFramework(rootPath) {
        const root = rootPath || this.getWorkspaceRoot() || process.cwd();
        const pkgPath = path.join(root, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            return { framework: 'vanilla', name: 'Web Application' };
        }
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps['next'])
                return { framework: 'next', name: 'Next.js' };
            if (deps['vite'])
                return { framework: 'vite', name: 'Vite' };
            if (deps['@angular/core'])
                return { framework: 'angular', name: 'Angular' };
            if (deps['vue'])
                return { framework: 'vue', name: 'Vue.js' };
            if (deps['react'])
                return { framework: 'react', name: 'React' };
        }
        catch {
            // ignore
        }
        return { framework: 'vanilla', name: 'Frontend Project' };
    }
    saveGhostSession(session, rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const sessionsDir = path.join(tgDir, 'sessions');
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }
        const filePath = path.join(sessionsDir, `${session.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
        output_channel_1.logger.info(`Saved Ghost Session: ${session.name} (${session.id}) to ${filePath}`);
        return filePath;
    }
    loadGhostSessions(rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const sessionsDir = path.join(tgDir, 'sessions');
        if (!fs.existsSync(sessionsDir)) {
            return [];
        }
        try {
            const files = fs.readdirSync(sessionsDir);
            const sessions = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const raw = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
                        const session = JSON.parse(raw);
                        if (session && session.id && session.name) {
                            sessions.push(session);
                        }
                    }
                    catch (e) {
                        output_channel_1.logger.error(`Error loading session file ${file}`, e);
                    }
                }
            }
            return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }
        catch (e) {
            output_channel_1.logger.error('Error scanning sessions directory', e);
            return [];
        }
    }
    loadGhostSession(id, rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const filePath = path.join(tgDir, 'sessions', `${id}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(raw);
            }
            catch (e) {
                output_channel_1.logger.error(`Error loading session ${id}`, e);
            }
        }
        return null;
    }
    deleteGhostSession(id, rootPath) {
        const tgDir = this.getTrafficGhostDir(rootPath);
        const filePath = path.join(tgDir, 'sessions', `${id}.json`);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                output_channel_1.logger.info(`Deleted Ghost Session: ${id}`);
                return true;
            }
            catch (e) {
                output_channel_1.logger.error(`Error deleting session ${id}`, e);
            }
        }
        return false;
    }
    renameGhostSession(id, newName, rootPath) {
        const session = this.loadGhostSession(id, rootPath);
        if (session) {
            session.name = newName;
            session.updatedAt = new Date().toISOString();
            this.saveGhostSession(session, rootPath);
            return true;
        }
        return false;
    }
}
exports.WorkspaceManager = WorkspaceManager;
//# sourceMappingURL=workspace-manager.js.map