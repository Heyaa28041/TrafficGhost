import { TrafficRecord, MockDefinition, GlobalSettings, EndpointModel } from "../models/types.js";
export declare class FileStorage {
    private readonly dir;
    constructor(workspaceRoot: string);
    private ensureDir;
    private filePath;
    private read;
    private write;
    saveTraffic(records: TrafficRecord[]): void;
    loadTraffic(): TrafficRecord[];
    saveMocks(mocks: MockDefinition[]): void;
    loadMocks(): MockDefinition[];
    saveEndpoints(endpoints: EndpointModel[]): void;
    loadEndpoints(): EndpointModel[];
    saveSettings(settings: GlobalSettings): void;
    loadSettings(): GlobalSettings;
    saveProject(meta: Record<string, unknown>): void;
    loadProject(): Record<string, unknown>;
    reset(): void;
    hasTraffic(): boolean;
    getStorageDir(): string;
}
//# sourceMappingURL=FileStorage.d.ts.map