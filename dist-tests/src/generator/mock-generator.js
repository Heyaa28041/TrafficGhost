"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockGenerator = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const scenario_1 = require("../models/scenario");
const config_1 = require("../models/config");
const output_channel_1 = require("../logging/output-channel");
class MockGenerator {
    /**
     * Generates mock definition files and project structure in the target project directory.
     */
    static generateMockFiles(targetDir, schema, config = config_1.DEFAULT_CONFIG) {
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
        fs.writeFileSync(scenariosPath, JSON.stringify(scenario_1.BUILTIN_SCENARIOS, null, 2), 'utf-8');
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
        output_channel_1.logger.info(`Generated mock definitions in: ${tgDir}`);
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
exports.MockGenerator = MockGenerator;
//# sourceMappingURL=mock-generator.js.map