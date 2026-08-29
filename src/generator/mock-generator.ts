import * as path from 'path';
import * as fs from 'fs';
import { TrafficGhostMockSchema, RestEndpointDefinition, GraphQLEndpointDefinition } from '../models/endpoint';
import { BUILTIN_SCENARIOS, ScenarioType } from '../models/scenario';
import { DEFAULT_CONFIG, TrafficGhostConfig } from '../models/config';
import { logger } from '../logging/output-channel';

export class MockGenerator {
  /**
   * Generates mock definition files and project structure in the target project directory.
   */
  public static generateMockFiles(
    targetDir: string,
    schema: TrafficGhostMockSchema,
    config: TrafficGhostConfig = DEFAULT_CONFIG
  ): {
    configPath: string;
    schemaPath: string;
    restMocksPath: string;
    graphqlMocksPath: string;
    scenariosPath: string;
    envPath: string;
  } {
    const tgDir = path.join(targetDir, 'trafficghost');
    const mocksDir = path.join(tgDir, 'mocks');
    const recordingsDir = path.join(tgDir, 'recordings');
    const scenariosDir = path.join(tgDir, 'scenarios');

    // Ensure directories exist
    [tgDir, mocksDir, recordingsDir, scenariosDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const configPath = path.join(tgDir, 'config.json');
    const schemaPath = path.join(tgDir, 'schema.json');
    const restMocksPath = path.join(mocksDir, 'rest.json');
    const graphqlMocksPath = path.join(mocksDir, 'graphql.json');
    const scenariosPath = path.join(scenariosDir, 'scenarios.json');
    const envPath = path.join(targetDir, '.env.trafficghost');

    // 1. Write config.json
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // 2. Write schema.json (full definition)
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');

    // 3. Write rest.json
    fs.writeFileSync(restMocksPath, JSON.stringify(schema.restEndpoints, null, 2), 'utf-8');

    // 4. Write graphql.json
    fs.writeFileSync(graphqlMocksPath, JSON.stringify(schema.graphqlEndpoints, null, 2), 'utf-8');

    // 5. Write scenarios.json
    fs.writeFileSync(scenariosPath, JSON.stringify(BUILTIN_SCENARIOS, null, 2), 'utf-8');

    // 6. Write .env.trafficghost example
    const envContent = `# TrafficGhost Local Mock Server Environment
# Point your frontend API base URL to TrafficGhost:
VITE_API_URL=http://localhost:${config.port}
REACT_APP_API_URL=http://localhost:${config.port}
NEXT_PUBLIC_API_URL=http://localhost:${config.port}
API_BASE_URL=http://localhost:${config.port}
TRAFFICGHOST_URL=http://localhost:${config.port}
`;
    fs.writeFileSync(envPath, envContent, 'utf-8');

    logger.info(`Generated mock definitions in: ${tgDir}`);
    return {
      configPath,
      schemaPath,
      restMocksPath,
      graphqlMocksPath,
      scenariosPath,
      envPath
    };
  }
}
