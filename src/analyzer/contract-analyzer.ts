/**
 * Analyzes contracts between two TrafficGhost schemas to find added/removed/modified fields and breaking changes.
 *
 * Connected to:
 *   - src/extension.ts           — commands (compareContracts)
 *   - src/views/dashboard-panel.ts — passes contract changes to UI
 */

import { TrafficGhostMockSchema, RestEndpointDefinition } from '../models/endpoint';

export interface FieldDiff {
  field: string;
  type: 'added' | 'removed' | 'type-changed';
  oldType?: string;
  newType?: string;
}

export interface EndpointDiff {
  endpointId: string;
  method: string;
  pathPattern: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  fieldDiffs: FieldDiff[];
  potentiallyBreaking: boolean;
}

export interface SchemaDiff {
  oldVersion: string;
  newVersion: string;
  endpointDiffs: EndpointDiff[];
  summary: { added: number; removed: number; changed: number; breaking: number };
}

export class ContractAnalyzer {
  public static compareSchemas(
    oldSchema: TrafficGhostMockSchema,
    newSchema: TrafficGhostMockSchema
  ): SchemaDiff {
    const diffs: EndpointDiff[] = [];
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
    const oldMap = new Map<string, RestEndpointDefinition>();
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
      } else {
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

  private static diffPayloads(oldBody: unknown, newBody: unknown): FieldDiff[] {
    const diffs: FieldDiff[] = [];
    if (!oldBody || !newBody) return diffs;

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
      } else if (oldType !== newType) {
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

  private static inferFieldTypes(obj: unknown, prefix = ''): Record<string, string> {
    const types: Record<string, string> = {};
    if (obj === null || obj === undefined) return types;

    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        return this.inferFieldTypes(obj[0], `${prefix}[]`);
      }
      return types;
    }

    if (typeof obj === 'object') {
      const record = obj as Record<string, unknown>;
      for (const [key, val] of Object.entries(record)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (val === null) {
          types[fullKey] = 'null';
        } else if (Array.isArray(val)) {
          if (val.length > 0 && typeof val[0] === 'object') {
            Object.assign(types, this.inferFieldTypes(val[0], `${fullKey}[]`));
          } else {
            types[fullKey] = 'array';
          }
        } else if (typeof val === 'object') {
          Object.assign(types, this.inferFieldTypes(val, fullKey));
        } else {
          types[fullKey] = typeof val;
        }
      }
    }

    return types;
  }
}
