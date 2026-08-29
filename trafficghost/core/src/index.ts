// TrafficGhost — Core Engine Entry Point
// Starts the ControlApi (port 4001). The mock server starts on-demand via the API.

import { ControlApi } from "./api/ControlApi.js";
import * as path from "path";
import * as fs from "fs";

// Resolve workspace root: passed as arg, else use CWD
const workspaceRoot = process.argv[2] ?? process.cwd();

// Validate workspace root exists
if (!fs.existsSync(workspaceRoot)) {
  console.error(`[TrafficGhost] Workspace root not found: ${workspaceRoot}`);
  process.exit(1);
}

const controlPort = parseInt(process.env.TG_CONTROL_PORT ?? "4001", 10);

const api = new ControlApi(path.resolve(workspaceRoot));

async function main() {
  try {
    await api.start(controlPort);

    // Signal readiness to the VS Code extension via stdout
    // The extension watches for this exact line
    console.log(`TRAFFICGHOST_READY:${controlPort}`);
  } catch (err) {
    console.error("[TrafficGhost] Failed to start control API:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[TrafficGhost] Shutting down...");
  await api.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await api.stop();
  process.exit(0);
});

main();
