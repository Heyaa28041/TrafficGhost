import { TrafficGhostConfig } from '../models/config';
import { TrafficGhostMockSchema } from '../models/endpoint';
import { CapturedRequest } from '../models/captured-request';
export declare class WorkspaceManager {
    private static instance;
    private constructor();
    static getInstance(): WorkspaceManager;
    getWorkspaceRoot(): string | undefined;
    getTrafficGhostDir(rootPath?: string): string;
    isProjectInitialized(rootPath?: string): boolean;
    initializeProject(rootPath?: string): {
        configPath: string;
        schemaPath: string;
        envPath: string;
    };
    saveRecording(requests: CapturedRequest[], rootPath?: string): string;
    loadConfig(rootPath?: string): TrafficGhostConfig;
    saveConfig(config: TrafficGhostConfig, rootPath?: string): void;
    loadSchema(rootPath?: string): TrafficGhostMockSchema | null;
    saveSchema(schema: TrafficGhostMockSchema, rootPath?: string): void;
    detectFrontendFramework(rootPath?: string): {
        framework: 'vite' | 'next' | 'react' | 'vue' | 'angular' | 'vanilla';
        name: string;
    };
}
