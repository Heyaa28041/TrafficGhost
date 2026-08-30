/**
 * Analyzes contracts between two TrafficGhost schemas to find added/removed/modified fields and breaking changes.
 *
 * Connected to:
 *   - src/extension.ts           — commands (compareContracts)
 *   - src/views/dashboard-panel.ts — passes contract changes to UI
 */
import { TrafficGhostMockSchema } from '../models/endpoint';
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
    summary: {
        added: number;
        removed: number;
        changed: number;
        breaking: number;
    };
}
export declare class ContractAnalyzer {
    static compareSchemas(oldSchema: TrafficGhostMockSchema, newSchema: TrafficGhostMockSchema): SchemaDiff;
    private static diffPayloads;
    private static inferFieldTypes;
}
