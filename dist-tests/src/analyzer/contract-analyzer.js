"use strict";
/**
 * Analyzes contracts between two TrafficGhost schemas to find added/removed/modified fields and breaking changes.
 *
 * Connected to:
 *   - src/extension.ts           — commands (compareContracts)
 *   - src/views/dashboard-panel.ts — passes contract changes to UI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractAnalyzer = void 0;
class ContractAnalyzer {
    static compareSchemas(oldSchema, newSchema) {
        const diffs = [];
        const summary = { added: 0, removed: 0, changed: 0, breaking: 0 };
        if (!oldSchema || !newSchema) {
            return {
                oldVersion: oldSchema?.version || '0.0.0',
                newVersion: newSchema?.version || '0.0.0',
                endpointDiffs: [],
                summary
            };
        }
        // Map old endpoints by method + pattern
        const oldMap = new Map();
        for (const ep of oldSchema.restEndpoints) {
            oldMap.set(`${ep.method}_${ep.pathPattern}`, ep);
        }
        // Compare with new endpoints
        for (const newEp of newSchema.restEndpoints) {
            const key = `${newEp.method}_${newEp.pathPattern}`;
            const oldEp = oldMap.get(key);
            if (!oldEp) {
                // Added endpoint
                diffs.push({
                    endpointId: newEp.id,
                    method: newEp.method,
                    pathPattern: newEp.pathPattern,
                    status: 'added',
                    fieldDiffs: [],
                    potentiallyBreaking: false
                });
                summary.added++;
                continue;
            }
            // Endpoint exists in both, check payload diffs
            oldMap.delete(key); // remove so we know it's not deleted
            const oldBody = oldEp.defaultResponse?.body;
            const newBody = newEp.defaultResponse?.body;
            const fieldDiffs = this.diffPayloads(oldBody, newBody);
            const isBreaking = fieldDiffs.some(fd => fd.type === 'removed' || fd.type === 'type-changed');
            if (fieldDiffs.length > 0) {
                diffs.push({
                    endpointId: newEp.id,
                    method: newEp.method,
                    pathPattern: newEp.pathPattern,
                    status: 'changed',
                    fieldDiffs,
                    potentiallyBreaking: isBreaking
                });
                summary.changed++;
                if (isBreaking) {
                    summary.breaking++;
                }
            }
            else {
                diffs.push({
                    endpointId: newEp.id,
                    method: newEp.method,
                    pathPattern: newEp.pathPattern,
                    status: 'unchanged',
                    fieldDiffs: [],
                    potentiallyBreaking: false
                });
            }
        }
        // Remaining old endpoints are deleted
        for (const oldEp of oldMap.values()) {
            diffs.push({
                endpointId: oldEp.id,
                method: oldEp.method,
                pathPattern: oldEp.pathPattern,
                status: 'removed',
                fieldDiffs: [],
                potentiallyBreaking: true // deleting an endpoint is breaking
            });
            summary.removed++;
            summary.breaking++;
        }
        return {
            oldVersion: oldSchema.version,
            newVersion: newSchema.version,
            endpointDiffs: diffs,
            summary
        };
    }
    static diffPayloads(oldBody, newBody) {
        const diffs = [];
        if (!oldBody || !newBody)
            return diffs;
        const oldTypes = this.inferFieldTypes(oldBody);
        const newTypes = this.inferFieldTypes(newBody);
        // Added and changed fields
        for (const [key, newType] of Object.entries(newTypes)) {
            const oldType = oldTypes[key];
            if (oldType === undefined) {
                diffs.push({
                    field: key,
                    type: 'added',
                    newType
                });
            }
            else if (oldType !== newType) {
                diffs.push({
                    field: key,
                    type: 'type-changed',
                    oldType,
                    newType
                });
            }
        }
        // Removed fields
        for (const [key, oldType] of Object.entries(oldTypes)) {
            if (newTypes[key] === undefined) {
                diffs.push({
                    field: key,
                    type: 'removed',
                    oldType
                });
            }
        }
        return diffs;
    }
    static inferFieldTypes(obj, prefix = '') {
        const types = {};
        if (obj === null || obj === undefined)
            return types;
        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                return this.inferFieldTypes(obj[0], `${prefix}[]`);
            }
            return types;
        }
        if (typeof obj === 'object') {
            const record = obj;
            for (const [key, val] of Object.entries(record)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (val === null) {
                    types[fullKey] = 'null';
                }
                else if (Array.isArray(val)) {
                    if (val.length > 0 && typeof val[0] === 'object') {
                        Object.assign(types, this.inferFieldTypes(val[0], `${fullKey}[]`));
                    }
                    else {
                        types[fullKey] = 'array';
                    }
                }
                else if (typeof val === 'object') {
                    Object.assign(types, this.inferFieldTypes(val, fullKey));
                }
                else {
                    types[fullKey] = typeof val;
                }
            }
        }
        return types;
    }
}
exports.ContractAnalyzer = ContractAnalyzer;
//# sourceMappingURL=contract-analyzer.js.map