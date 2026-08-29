// TrafficGhost — File Storage
// Persists project state to .trafficghost/ JSON files in the workspace.
import * as fs from "fs";
import * as path from "path";
import { DEFAULT_SETTINGS, } from "../models/types.js";
export class FileStorage {
    dir;
    constructor(workspaceRoot) {
        this.dir = path.join(workspaceRoot, ".trafficghost");
    }
    ensureDir() {
        fs.mkdirSync(this.dir, { recursive: true });
    }
    filePath(name) {
        return path.join(this.dir, name);
    }
    read(name, fallback) {
        const fp = this.filePath(name);
        if (!fs.existsSync(fp))
            return fallback;
        try {
            return JSON.parse(fs.readFileSync(fp, "utf-8"));
        }
        catch {
            return fallback;
        }
    }
    write(name, data) {
        this.ensureDir();
        fs.writeFileSync(this.filePath(name), JSON.stringify(data, null, 2), "utf-8");
    }
    // Traffic records
    saveTraffic(records) {
        this.write("traffic.json", records);
    }
    loadTraffic() {
        return this.read("traffic.json", []);
    }
    // Mock definitions
    saveMocks(mocks) {
        this.write("mocks.json", mocks);
    }
    loadMocks() {
        return this.read("mocks.json", []);
    }
    // Endpoints (analyzed)
    saveEndpoints(endpoints) {
        this.write("endpoints.json", endpoints);
    }
    loadEndpoints() {
        return this.read("endpoints.json", []);
    }
    // Settings
    saveSettings(settings) {
        this.write("settings.json", settings);
    }
    loadSettings() {
        return this.read("settings.json", { ...DEFAULT_SETTINGS });
    }
    // Project metadata
    saveProject(meta) {
        this.write("project.json", meta);
    }
    loadProject() {
        return this.read("project.json", {});
    }
    // Reset — clears all stored data
    reset() {
        const files = ["traffic.json", "mocks.json", "endpoints.json", "project.json"];
        for (const f of files) {
            const fp = this.filePath(f);
            if (fs.existsSync(fp))
                fs.rmSync(fp);
        }
    }
    // Check if workspace has existing traffic
    hasTraffic() {
        const records = this.loadTraffic();
        return records.length > 0;
    }
    getStorageDir() {
        return this.dir;
    }
}
//# sourceMappingURL=FileStorage.js.map