import * as path from 'path';
import * as fs from 'fs';
import { TrafficGhostConfig, DEFAULT_CONFIG } from '../models/config';
import { TrafficGhostMockSchema } from '../models/endpoint';
import { CapturedRequest } from '../models/captured-request';
import { GhostSession } from '../models/ghost-session';
import { BUILTIN_SCENARIOS } from '../models/scenario';
import { logger } from '../logging/output-channel';

let vscodeModule: any = null;
try {
  vscodeModule = require('vscode');
} catch {
  vscodeModule = null;
}

export class WorkspaceManager {
  private static instance: WorkspaceManager;

  private constructor() {}

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  public getWorkspaceRoot(): string | undefined {
    try {
      if (vscodeModule && vscodeModule.workspace && vscodeModule.workspace.workspaceFolders) {
        const folders = vscodeModule.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
          return folders[0].uri.fsPath;
        }
      }
    } catch {
      // ignore
    }
    return process.cwd();
  }

  public getTrafficGhostDir(rootPath?: string): string {
    const root = rootPath || this.getWorkspaceRoot() || process.cwd();
    return path.join(root, 'trafficghost');
  }

  public isProjectInitialized(rootPath?: string): boolean {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const configPath = path.join(tgDir, 'config.json');
    return fs.existsSync(configPath);
  }

  public initializeProject(rootPath?: string): {
    configPath: string;
    schemaPath: string;
    envPath: string;
  } {
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
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    }

    if (!fs.existsSync(scenariosPath)) {
      fs.writeFileSync(scenariosPath, JSON.stringify(BUILTIN_SCENARIOS, null, 2), 'utf-8');
    }

    const initialSchema: TrafficGhostMockSchema = {
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

    logger.info(`Initialized TrafficGhost project structure in ${tgDir}`);
    return { configPath, schemaPath, envPath };
  }

  public saveRecording(requests: CapturedRequest[], rootPath?: string): string {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const recordingsDir = path.join(tgDir, 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(recordingsDir, `capture_${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(requests, null, 2), 'utf-8');
    logger.info(`Saved ${requests.length} requests to ${filePath}`);
    return filePath;
  }

  public loadConfig(rootPath?: string): TrafficGhostConfig {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const configPath = path.join(tgDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        logger.error(`Error loading config from ${configPath}`, err);
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(config: TrafficGhostConfig, rootPath?: string): void {
    const tgDir = this.getTrafficGhostDir(rootPath);
    if (!fs.existsSync(tgDir)) {
      fs.mkdirSync(tgDir, { recursive: true });
    }
    const configPath = path.join(tgDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  public loadSchema(rootPath?: string): TrafficGhostMockSchema | null {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const schemaPath = path.join(tgDir, 'schema.json');
    if (fs.existsSync(schemaPath)) {
      try {
        const raw = fs.readFileSync(schemaPath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        logger.error(`Error loading schema from ${schemaPath}`, err);
      }
    }
    return null;
  }

  public saveSchema(schema: TrafficGhostMockSchema, rootPath?: string): void {
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

  public detectFrontendFramework(rootPath?: string): {
    framework: 'vite' | 'next' | 'react' | 'vue' | 'angular' | 'vanilla';
    name: string;
  } {
    const root = rootPath || this.getWorkspaceRoot() || process.cwd();
    const pkgPath = path.join(root, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { framework: 'vanilla', name: 'Web Application' };
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return { framework: 'next', name: 'Next.js' };
      if (deps['vite']) return { framework: 'vite', name: 'Vite' };
      if (deps['@angular/core']) return { framework: 'angular', name: 'Angular' };
      if (deps['vue']) return { framework: 'vue', name: 'Vue.js' };
      if (deps['react']) return { framework: 'react', name: 'React' };
    } catch {
      // ignore
    }

    return { framework: 'vanilla', name: 'Frontend Project' };
  }

  public saveGhostSession(session: GhostSession, rootPath?: string): string {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const sessionsDir = path.join(tgDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    const filePath = path.join(sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    logger.info(`Saved Ghost Session: ${session.name} (${session.id}) to ${filePath}`);
    return filePath;
  }

  public loadGhostSessions(rootPath?: string): GhostSession[] {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const sessionsDir = path.join(tgDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(sessionsDir);
      const sessions: GhostSession[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
            const session = JSON.parse(raw) as GhostSession;
            if (session && session.id && session.name) {
              sessions.push(session);
            }
          } catch (e) {
            logger.error(`Error loading session file ${file}`, e);
          }
        }
      }
      return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (e) {
      logger.error('Error scanning sessions directory', e);
      return [];
    }
  }

  public loadGhostSession(id: string, rootPath?: string): GhostSession | null {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const filePath = path.join(tgDir, 'sessions', `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as GhostSession;
      } catch (e) {
        logger.error(`Error loading session ${id}`, e);
      }
    }
    return null;
  }

  public deleteGhostSession(id: string, rootPath?: string): boolean {
    const tgDir = this.getTrafficGhostDir(rootPath);
    const filePath = path.join(tgDir, 'sessions', `${id}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Deleted Ghost Session: ${id}`);
        return true;
      } catch (e) {
        logger.error(`Error deleting session ${id}`, e);
      }
    }
    return false;
  }

  public renameGhostSession(id: string, newName: string, rootPath?: string): boolean {
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
