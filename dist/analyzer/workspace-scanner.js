"use strict";
/**
 * Scans the VS Code workspace line by line to detect where APIs are referenced.
 *
 * Connected to:
 *   - src/extension.ts (commands: findApiUsage, openApiUsage)
 *   - src/providers/api-hover-provider.ts (hover shows usages count)
 *   - src/providers/api-codelens-provider.ts (codelens shows usages)
 *   - src/views/dashboard-panel.ts (webview receives scanned usage map)
 */
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
exports.WorkspaceScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WorkspaceScanner {
    static cache = new Map();
    static clearCache() {
        this.cache.clear();
    }
    static getCached(endpointId) {
        return this.cache.get(endpointId) || null;
    }
    /**
     * Scans all files in the workspace for references to this REST endpoint.
     */
    static async scanForEndpoint(endpointId, method, pathPattern, workspaceRoot) {
        const cacheKey = `${endpointId}_${method}_${pathPattern}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        const result = {
            endpointId,
            method,
            pathPattern,
            usages: [],
            lastScannedAt: new Date().toISOString()
        };
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
            return result;
        }
        // Identify search segments
        // e.g. /api/users/:id -> ['api', 'users']
        // e.g. /api/v1/products -> ['api', 'v1', 'products'] or ['products']
        const cleanPattern = pathPattern.replace(/:[a-zA-Z0-9]+/g, ''); // strip parameters
        const segments = cleanPattern.split('/').filter(Boolean);
        if (segments.length === 0)
            return result;
        const filesToScan = [];
        this.scanDirRecursive(workspaceRoot, filesToScan);
        for (const filePath of filesToScan) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (!content)
                    continue;
                // Fast check before parsing lines
                const hasMatch = segments.some(seg => content.includes(seg)) || content.includes(cleanPattern);
                if (!hasMatch)
                    continue;
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;
                    // Check confidence
                    // CONFIRMED: exact full pattern (without params) is in string literal
                    // LIKELY: segments are found near API call keywords
                    // POSSIBLE: segments are found in file
                    const hasFullPattern = line.includes(cleanPattern) || line.includes(pathPattern);
                    const isConfirmed = hasFullPattern && (line.includes('"') || line.includes("'") || line.includes('`'));
                    let usageType = 'other';
                    if (line.includes('fetch(') || line.includes('fetch ')) {
                        usageType = 'fetch';
                    }
                    else if (line.includes('axios') || line.includes('axios.')) {
                        usageType = 'axios';
                    }
                    else if (/api\.|client\.|request\.|http\./.test(line)) {
                        usageType = 'wrapper';
                    }
                    if (isConfirmed) {
                        result.usages.push({
                            filePath,
                            lineNumber: lineNum,
                            lineContent: line.trim(),
                            confidence: 'CONFIRMED',
                            usageType
                        });
                    }
                    else {
                        const hasSegments = segments.every(seg => line.toLowerCase().includes(seg.toLowerCase()));
                        if (hasSegments) {
                            const isLikely = /fetch|axios|api|http|get|post|put|patch|delete/i.test(line);
                            result.usages.push({
                                filePath,
                                lineNumber: lineNum,
                                lineContent: line.trim(),
                                confidence: isLikely ? 'LIKELY' : 'POSSIBLE',
                                usageType
                            });
                        }
                    }
                }
            }
            catch (err) {
                // ignore read/access errors
            }
        }
        this.cache.set(cacheKey, result);
        return result;
    }
    /**
     * Scan all endpoints in a schema.
     */
    static async scanAllEndpoints(schema, workspaceRoot) {
        if (!schema)
            return [];
        const results = [];
        for (const ep of schema.restEndpoints) {
            const res = await this.scanForEndpoint(ep.id, ep.method, ep.pathPattern, workspaceRoot);
            results.push(res);
        }
        return results;
    }
    static scanDirRecursive(dir, fileList) {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    // Skip ignore folders
                    if (['node_modules', '.git', 'dist', 'build', 'out', 'trafficghost', '.trafficghost'].includes(file)) {
                        continue;
                    }
                    this.scanDirRecursive(fullPath, fileList);
                }
                else if (stat.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    if (['.ts', '.tsx', '.js', '.jsx', '.vue'].includes(ext)) {
                        fileList.push(fullPath);
                    }
                }
            }
        }
        catch {
            // ignore
        }
    }
}
exports.WorkspaceScanner = WorkspaceScanner;
//# sourceMappingURL=workspace-scanner.js.map