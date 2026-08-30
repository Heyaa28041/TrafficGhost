"use strict";
/**
 * Suggests likely files in the workspace where an unintegrated API should be placed.
 *
 * Connected to:
 *   - src/extension.ts           — commands (integration gap check)
 *   - src/views/dashboard-panel.ts — passes advice to Dashboard Webview
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
exports.IntegrationAdvisor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class IntegrationAdvisor {
    /**
     * Suggests possible locations for integrating an endpoint.
     */
    static suggestLocations(pathPattern, workspaceRoot) {
        const suggestions = [];
        if (!workspaceRoot || !fs.existsSync(workspaceRoot))
            return suggestions;
        // Extract search keywords (e.g. /api/v1/users/:id -> ['users'])
        const cleanPattern = pathPattern.replace(/:[a-zA-Z0-9]+/g, '');
        const segments = cleanPattern.split('/').filter(Boolean).filter(s => s !== 'api' && s !== 'v1' && s !== 'v2');
        if (segments.length === 0)
            return suggestions;
        const mainKeyword = segments[segments.length - 1].toLowerCase(); // e.g. 'users'
        const singularKeyword = mainKeyword.endsWith('s') ? mainKeyword.substring(0, mainKeyword.length - 1) : mainKeyword; // e.g. 'user'
        const files = [];
        this.collectSourceFiles(workspaceRoot, files);
        const scored = [];
        for (const file of files) {
            const fileName = path.basename(file).toLowerCase();
            const folderName = path.dirname(file).split(path.sep).pop()?.toLowerCase() || '';
            let score = 0;
            const reasons = [];
            // 1. Filename match
            if (fileName.includes(mainKeyword) || fileName.includes(singularKeyword)) {
                score += 5;
                reasons.push(`Filename match: File name contains keyword '${singularKeyword}'`);
            }
            // 2. Folder match
            if (folderName.includes(mainKeyword) || folderName.includes(singularKeyword)) {
                score += 3;
                reasons.push(`Directory match: File is located in folder containing keyword '${singularKeyword}'`);
            }
            // 3. Import check
            try {
                const content = fs.readFileSync(file, 'utf-8');
                if (content.includes(`import`) && (content.includes(mainKeyword) || content.includes(singularKeyword))) {
                    score += 2;
                    reasons.push(`Import match: File imports dependencies related to keyword '${singularKeyword}'`);
                }
            }
            catch {
                // ignore
            }
            if (score > 0) {
                scored.push({ filePath: file, score, reasons });
            }
        }
        // Sort by score
        scored.sort((a, b) => b.score - a.score);
        // Pick top 3
        for (const item of scored.slice(0, 3)) {
            let confidence = 'LOW';
            if (item.score >= 8) {
                confidence = 'HIGH';
            }
            else if (item.score >= 5) {
                confidence = 'MEDIUM';
            }
            const reasonStr = item.reasons.join(', ');
            suggestions.push({
                filePath: item.filePath,
                reason: confidence === 'LOW' ? `Possible location — low confidence. ${reasonStr}` : reasonStr,
                confidence
            });
        }
        return suggestions;
    }
    static collectSourceFiles(dir, fileList) {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (['node_modules', '.git', 'dist', 'build', 'out', 'trafficghost', '.trafficghost'].includes(file)) {
                        continue;
                    }
                    this.collectSourceFiles(fullPath, fileList);
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
exports.IntegrationAdvisor = IntegrationAdvisor;
//# sourceMappingURL=integration-advisor.js.map