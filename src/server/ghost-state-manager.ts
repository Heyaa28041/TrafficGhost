/**
 * In-memory state manager for stateful CRUD operations in Ghost Mode.
 *
 * Connected to:
 *   - src/server/mock-server.ts      — dynamic mock response generation & CRUD handling
 *   - src/server/server-manager.ts    — lifetime control (reset/seed on Ghost session change)
 *   - src/views/dashboard-panel.ts   — state inspections
 */

import { TrafficGhostMockSchema } from '../models/endpoint';

export class GhostStateManager {
  private static instance: GhostStateManager;
  private resourceState: Map<string, unknown[]> = new Map();

  private constructor() {}

  public static getInstance(): GhostStateManager {
    if (!GhostStateManager.instance) {
      GhostStateManager.instance = new GhostStateManager();
    }
    return GhostStateManager.instance;
  }

  public reset(): void {
    this.resourceState.clear();
  }

  /**
   * Infers the resource key from a path pattern or raw path.
   * e.g. /api/users/:id -> users
   *      /api/v1/products -> products
   *      /api/orders/:id/items -> items
   */
  public inferResourceKey(pathPattern: string): string | null {
    if (!pathPattern) return null;
    // Split by / and filter out parameters/empty segments
    const segments = pathPattern.split('/').filter(Boolean).filter(s => !s.startsWith(':') && s !== 'api' && s !== 'v1' && s !== 'v2');
    if (segments.length === 0) return null;
    // Return last segment
    return segments[segments.length - 1].toLowerCase();
  }

  public hasState(key: string): boolean {
    return this.resourceState.has(key.toLowerCase());
  }

  public getAll(key: string): unknown[] {
    return this.resourceState.get(key.toLowerCase()) || [];
  }

  public getById(key: string, idValue: unknown): unknown | null {
    const items = this.getAll(key);
    const idStr = String(idValue);
    return items.find(item => {
      if (item && typeof item === 'object') {
        const itemObj = item as Record<string, unknown>;
        return String(itemObj.id) === idStr || String(itemObj._id) === idStr;
      }
      return false;
    }) || null;
  }

  public create(key: string, item: unknown): unknown {
    const lowerKey = key.toLowerCase();
    const items = this.getAll(lowerKey);
    const newItem = JSON.parse(JSON.stringify(item || {}));

    // Ensure item has an ID
    if (typeof newItem === 'object' && newItem !== null) {
      const obj = newItem as Record<string, unknown>;
      if (!obj.id && !obj._id) {
        obj.id = items.length + 1;
      }
    }

    items.push(newItem);
    this.resourceState.set(lowerKey, items);
    return newItem;
  }

  public update(key: string, idValue: unknown, partial: unknown): unknown | null {
    const lowerKey = key.toLowerCase();
    const items = this.getAll(lowerKey);
    const idStr = String(idValue);

    let updatedItem: unknown | null = null;
    const newItems = items.map(item => {
      if (item && typeof item === 'object') {
        const itemObj = item as Record<string, unknown>;
        if (String(itemObj.id) === idStr || String(itemObj._id) === idStr) {
          updatedItem = { ...itemObj, ...(partial as object) };
          return updatedItem;
        }
      }
      return item;
    });

    if (updatedItem) {
      this.resourceState.set(lowerKey, newItems);
    }
    return updatedItem;
  }

  public delete(key: string, idValue: unknown): boolean {
    const lowerKey = key.toLowerCase();
    const items = this.getAll(lowerKey);
    const idStr = String(idValue);

    const initialLength = items.length;
    const filtered = items.filter(item => {
      if (item && typeof item === 'object') {
        const itemObj = item as Record<string, unknown>;
        return String(itemObj.id) !== idStr && String(itemObj._id) !== idStr;
      }
      return true;
    });

    this.resourceState.set(lowerKey, filtered);
    return filtered.length < initialLength;
  }

  /**
   * Seeds the in-memory state from the mock schema response defaults.
   */
  public seedFromSchema(schema: TrafficGhostMockSchema): void {
    this.reset();
    if (!schema) return;

    for (const ep of schema.restEndpoints) {
      const key = this.inferResourceKey(ep.pathPattern);
      if (!key) continue;

      const body = ep.defaultResponse?.body;
      if (!body) continue;

      // Seed if body is array or object and we don't have state yet
      if (!this.hasState(key)) {
        if (Array.isArray(body)) {
          this.resourceState.set(key, JSON.parse(JSON.stringify(body)));
        } else if (body && typeof body === 'object') {
          // If it's a single object, we can wrap it or look inside keys (like data, items)
          const obj = body as Record<string, unknown>;
          if (Array.isArray(obj.items)) {
            this.resourceState.set(key, JSON.parse(JSON.stringify(obj.items)));
          } else if (Array.isArray(obj.data)) {
            this.resourceState.set(key, JSON.parse(JSON.stringify(obj.data)));
          } else if (Array.isArray(obj.users)) {
            this.resourceState.set(key, JSON.parse(JSON.stringify(obj.users)));
          } else if (Array.isArray(obj.products)) {
            this.resourceState.set(key, JSON.parse(JSON.stringify(obj.products)));
          } else {
            // Keep single object as single item in list
            this.resourceState.set(key, [JSON.parse(JSON.stringify(body))]);
          }
        }
      }
    }
  }

  public getSnapshot(): Record<string, unknown[]> {
    const snapshot: Record<string, unknown[]> = {};
    for (const [k, v] of this.resourceState.entries()) {
      snapshot[k] = v;
    }
    return snapshot;
  }
}
