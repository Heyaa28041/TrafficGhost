"use strict";
/**
 * In-memory state manager for stateful CRUD operations in Ghost Mode.
 *
 * Connected to:
 *   - src/server/mock-server.ts      — dynamic mock response generation & CRUD handling
 *   - src/server/server-manager.ts    — lifetime control (reset/seed on Ghost session change)
 *   - src/views/dashboard-panel.ts   — state inspections
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GhostStateManager = void 0;
class GhostStateManager {
    static instance;
    resourceState = new Map();
    constructor() { }
    static getInstance() {
        if (!GhostStateManager.instance) {
            GhostStateManager.instance = new GhostStateManager();
        }
        return GhostStateManager.instance;
    }
    reset() {
        this.resourceState.clear();
    }
    /**
     * Infers the resource key from a path pattern or raw path.
     * e.g. /api/users/:id -> users
     *      /api/v1/products -> products
     *      /api/orders/:id/items -> items
     */
    inferResourceKey(pathPattern) {
        if (!pathPattern)
            return null;
        // Split by / and filter out parameters/empty segments
        const segments = pathPattern.split('/').filter(Boolean).filter(s => !s.startsWith(':') && s !== 'api' && s !== 'v1' && s !== 'v2');
        if (segments.length === 0)
            return null;
        // Return last segment
        return segments[segments.length - 1].toLowerCase();
    }
    hasState(key) {
        return this.resourceState.has(key.toLowerCase());
    }
    getAll(key) {
        return this.resourceState.get(key.toLowerCase()) || [];
    }
    getById(key, idValue) {
        const items = this.getAll(key);
        const idStr = String(idValue);
        return items.find(item => {
            if (item && typeof item === 'object') {
                const itemObj = item;
                return String(itemObj.id) === idStr || String(itemObj._id) === idStr;
            }
            return false;
        }) || null;
    }
    create(key, item) {
        const lowerKey = key.toLowerCase();
        const items = this.getAll(lowerKey);
        const newItem = JSON.parse(JSON.stringify(item || {}));
        // Ensure item has an ID
        if (typeof newItem === 'object' && newItem !== null) {
            const obj = newItem;
            if (!obj.id && !obj._id) {
                obj.id = items.length + 1;
            }
        }
        items.push(newItem);
        this.resourceState.set(lowerKey, items);
        return newItem;
    }
    update(key, idValue, partial) {
        const lowerKey = key.toLowerCase();
        const items = this.getAll(lowerKey);
        const idStr = String(idValue);
        let updatedItem = null;
        const newItems = items.map(item => {
            if (item && typeof item === 'object') {
                const itemObj = item;
                if (String(itemObj.id) === idStr || String(itemObj._id) === idStr) {
                    updatedItem = { ...itemObj, ...partial };
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
    delete(key, idValue) {
        const lowerKey = key.toLowerCase();
        const items = this.getAll(lowerKey);
        const idStr = String(idValue);
        const initialLength = items.length;
        const filtered = items.filter(item => {
            if (item && typeof item === 'object') {
                const itemObj = item;
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
    seedFromSchema(schema) {
        this.reset();
        if (!schema)
            return;
        for (const ep of schema.restEndpoints) {
            const key = this.inferResourceKey(ep.pathPattern);
            if (!key)
                continue;
            const body = ep.defaultResponse?.body;
            if (!body)
                continue;
            // Seed if body is array or object and we don't have state yet
            if (!this.hasState(key)) {
                if (Array.isArray(body)) {
                    this.resourceState.set(key, JSON.parse(JSON.stringify(body)));
                }
                else if (body && typeof body === 'object') {
                    // If it's a single object, we can wrap it or look inside keys (like data, items)
                    const obj = body;
                    if (Array.isArray(obj.items)) {
                        this.resourceState.set(key, JSON.parse(JSON.stringify(obj.items)));
                    }
                    else if (Array.isArray(obj.data)) {
                        this.resourceState.set(key, JSON.parse(JSON.stringify(obj.data)));
                    }
                    else if (Array.isArray(obj.users)) {
                        this.resourceState.set(key, JSON.parse(JSON.stringify(obj.users)));
                    }
                    else if (Array.isArray(obj.products)) {
                        this.resourceState.set(key, JSON.parse(JSON.stringify(obj.products)));
                    }
                    else {
                        // Keep single object as single item in list
                        this.resourceState.set(key, [JSON.parse(JSON.stringify(body))]);
                    }
                }
            }
        }
    }
    getSnapshot() {
        const snapshot = {};
        for (const [k, v] of this.resourceState.entries()) {
            snapshot[k] = v;
        }
        return snapshot;
    }
}
exports.GhostStateManager = GhostStateManager;
//# sourceMappingURL=ghost-state-manager.js.map