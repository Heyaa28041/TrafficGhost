/**
 * Generates test skeletons based on captured endpoint details and observed HTTP status codes.
 *
 * Connected to:
 *   - src/extension.ts (commands: generateTest)
 */
import { RestEndpointDefinition } from '../models/endpoint';
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'node-test';
export interface GeneratedTest {
    code: string;
    framework: TestFramework;
    testCount: number;
    sourceEndpointId: string;
}
export declare class TestGenerator {
    static detectFramework(workspaceRoot: string): TestFramework;
    static generateForEndpoint(endpoint: RestEndpointDefinition, workspaceRoot: string): GeneratedTest;
    static generateResilienceTest(endpoint: RestEndpointDefinition, workspaceRoot: string): GeneratedTest;
}
