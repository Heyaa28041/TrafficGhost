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

import { CapturedRequest } from './captured-request';
import { TrafficGhostMockSchema } from './endpoint';

/**
 * Metadata summary of a Ghost Session (stored separately for fast list loading).
 */
export interface GhostSessionMetadata {
  requestCount: number;
  restEndpointCount: number;
  graphqlEndpointCount: number;
  targetUrl?: string;
  durationMs?: number;
  tags?: string[];
}

/**
 * A complete Ghost Session containing all recorded requests and the derived mock schema.
 */
export interface GhostSession {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  requests: CapturedRequest[];
  schema: TrafficGhostMockSchema;
  metadata: GhostSessionMetadata;
}

/**
 * Ghost Mode operational status.
 */
export type GhostModeStatus = 'inactive' | 'active';

/**
 * Current Ghost Mode state (what the UI displays).
 */
export interface GhostModeState {
  status: GhostModeStatus;
  activeSessionId: string | null;
  activeSessionName: string | null;
  mockServerPort: number | null;
}

/**
 * Generates a stable slug-based ID from a session name and timestamp.
 */
export function generateSessionId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
  const ts = Date.now().toString(36);
  return `${slug}-${ts}`;
}
