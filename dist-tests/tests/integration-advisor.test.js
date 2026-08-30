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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const integration_advisor_1 = require("../src/analyzer/integration-advisor");
(0, node_test_1.describe)('IntegrationAdvisor tests', () => {
    const root = path.join(__dirname, 'temp_advisor_test');
    (0, node_test_1.before)(() => {
        if (!fs.existsSync(root)) {
            fs.mkdirSync(root, { recursive: true });
        }
        const pagesDir = path.join(root, 'pages');
        if (!fs.existsSync(pagesDir)) {
            fs.mkdirSync(pagesDir, { recursive: true });
        }
        fs.writeFileSync(path.join(pagesDir, 'Users.tsx'), `import * as React from 'react';\n// Users List Component`);
        fs.writeFileSync(path.join(root, 'index.ts'), `// Root index file`);
    });
    (0, node_test_1.after)(() => {
        try {
            fs.rmSync(root, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    });
    (0, node_test_1.it)('should suggest pages/Users.tsx for endpoint /api/users', () => {
        const suggestions = integration_advisor_1.IntegrationAdvisor.suggestLocations('/api/users', root);
        assert_1.default.ok(suggestions.length > 0);
        assert_1.default.strictEqual(path.basename(suggestions[0].filePath), 'Users.tsx');
        assert_1.default.ok(suggestions[0].reason.includes('Filename match'));
    });
});
//# sourceMappingURL=integration-advisor.test.js.map