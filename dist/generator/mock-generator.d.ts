import { TrafficGhostMockSchema } from '../models/endpoint';
import { TrafficGhostConfig } from '../models/config';
export declare class MockGenerator {
    /**
     * Generates mock definition files and project structure in the target project directory.
     */
    static generateMockFiles(targetDir: string, schema: TrafficGhostMockSchema, config?: TrafficGhostConfig): {
        configPath: string;
        schemaPath: string;
        restMocksPath: string;
        graphqlMocksPath: string;
        scenariosPath: string;
        envPath: string;
    };
}
