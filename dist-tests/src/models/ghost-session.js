"use strict";
/**
 * Ghost Session data models.
 *
 * Connected to:
 *   - src/storage/workspace-manager.ts  — persistence (save/load/delete sessions)
 *   - src/server/server-manager.ts      — Ghost Mode lifecycle (enterGhostMode, exitGhostMode)
 *   - src/server/ghost-state-manager.ts — in-memory state layer during Ghost Mode
 *   - src/extension.ts                  — Ghost Session commands
 *   - src/views/tree-view-provider.ts   — GhostSessionsTreeProvider
 *   - src/webview/dashboard.*           — Ghost Mode UI tab
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSessionId = generateSessionId;
/**
 * Generates a stable slug-based ID from a session name and timestamp.
 */
function generateSessionId(name) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 40);
    const ts = Date.now().toString(36);
    return `${slug}-${ts}`;
}
//# sourceMappingURL=ghost-session.js.map