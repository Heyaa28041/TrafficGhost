/**
 * In-memory state manager for stateful CRUD operations in Ghost Mode.
 *
 * Connected to:
 *   - src/server/mock-server.ts      — dynamic mock response generation & CRUD handling
 *   - src/server/server-manager.ts    — lifetime control (reset/seed on Ghost session change)
 *   - src/views/dashboard-panel.ts   — state inspections
 */
import { TrafficGhostMockSchema } from '../models/endpoint';
export declare class GhostStateManager {
    private static instance;
    private resourceState;
    private constructor();
    static getInstance(): GhostStateManager;
    reset(): void;
    /**
     * Infers the resource key from a path pattern or raw path.
     * e.g. /api/users/:id -> users
     *      /api/v1/products -> products
     *      /api/orders/:id/items -> items
     */
    inferResourceKey(pathPattern: string): string | null;
    hasState(key: string): boolean;
    getAll(key: string): unknown[];
    getById(key: string, idValue: unknown): unknown | null;
    create(key: string, item: unknown): unknown;
    update(key: string, idValue: unknown, partial: unknown): unknown | null;
    delete(key: string, idValue: unknown): boolean;
    /**
     * Seeds the in-memory state from the mock schema response defaults.
     */
    seedFromSchema(schema: TrafficGhostMockSchema): void;
    getSnapshot(): Record<string, unknown[]>;
}
