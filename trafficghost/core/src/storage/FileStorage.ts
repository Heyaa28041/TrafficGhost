// TrafficGhost — File Storage
// Persists project state to .trafficghost/ JSON files in the workspace.

import * as fs from "fs";
import * as path from "path";
import {
  TrafficRecord,
  MockDefinition,
  GlobalSettings,
  DEFAULT_SETTINGS,
  EndpointModel,
} from "../models/types.js";

export class FileStorage {
  private readonly dir: string;

  constructor(workspaceRoot: string) {
    this.dir = path.join(workspaceRoot, ".trafficghost");
  }

  private ensureDir(): void {
    fs.mkdirSync(this.dir, { recursive: true });
  }

  private filePath(name: string): string {
    return path.join(this.dir, name);
  }

  private read<T>(name: string, fallback: T): T {
    const fp = this.filePath(name);
    if (!fs.existsSync(fp)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
    } catch {
      return fallback;
    }
  }

  private write(name: string, data: unknown): void {
    this.ensureDir();
    fs.writeFileSync(this.filePath(name), JSON.stringify(data, null, 2), "utf-8");
  }

  // Traffic records
  saveTraffic(records: TrafficRecord[]): void {
    this.write("traffic.json", records);
  }

  loadTraffic(): TrafficRecord[] {
    return this.read<TrafficRecord[]>("traffic.json", []);
  }

  // Mock definitions
  saveMocks(mocks: MockDefinition[]): void {
    this.write("mocks.json", mocks);
  }

  loadMocks(): MockDefinition[] {
    return this.read<MockDefinition[]>("mocks.json", []);
  }

  // Endpoints (analyzed)
  saveEndpoints(endpoints: EndpointModel[]): void {
    this.write("endpoints.json", endpoints);
  }

  loadEndpoints(): EndpointModel[] {
    return this.read<EndpointModel[]>("endpoints.json", []);
  }

  // Settings
  saveSettings(settings: GlobalSettings): void {
    this.write("settings.json", settings);
  }

  loadSettings(): GlobalSettings {
    return this.read<GlobalSettings>("settings.json", { ...DEFAULT_SETTINGS });
  }

  // Project metadata
  saveProject(meta: Record<string, unknown>): void {
    this.write("project.json", meta);
  }

  loadProject(): Record<string, unknown> {
    return this.read<Record<string, unknown>>("project.json", {});
  }

  // Reset — clears all stored data
  reset(): void {
    const files = ["traffic.json", "mocks.json", "endpoints.json", "project.json"];
    for (const f of files) {
      const fp = this.filePath(f);
      if (fs.existsSync(fp)) fs.rmSync(fp);
    }
  }

  // Check if workspace has existing traffic
  hasTraffic(): boolean {
    const records = this.loadTraffic();
    return records.length > 0;
  }

  getStorageDir(): string {
    return this.dir;
  }
}
