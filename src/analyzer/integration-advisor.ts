/**
 * Suggests likely files in the workspace where an unintegrated API should be placed.
 *
 * Connected to:
 *   - src/extension.ts           — commands (integration gap check)
 *   - src/views/dashboard-panel.ts — passes advice to Dashboard Webview
 */

import * as fs from 'fs';
import * as path from 'path';

export interface IntegrationSuggestion {
  filePath: string;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class IntegrationAdvisor {
  /**
   * Suggests possible locations for integrating an endpoint.
   */
  public static suggestLocations(
    pathPattern: string,
    workspaceRoot: string
  ): IntegrationSuggestion[] {
    const suggestions: IntegrationSuggestion[] = [];
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return suggestions;

    // Extract search keywords (e.g. /api/v1/users/:id -> ['users'])
    const cleanPattern = pathPattern.replace(/:[a-zA-Z0-9]+/g, '');
    const segments = cleanPattern.split('/').filter(Boolean).filter(s => s !== 'api' && s !== 'v1' && s !== 'v2');
    if (segments.length === 0) return suggestions;

    const mainKeyword = segments[segments.length - 1].toLowerCase(); // e.g. 'users'
    const singularKeyword = mainKeyword.endsWith('s') ? mainKeyword.substring(0, mainKeyword.length - 1) : mainKeyword; // e.g. 'user'

    const files: string[] = [];
    this.collectSourceFiles(workspaceRoot, files);

    const scored: { filePath: string; score: number; reasons: string[] }[] = [];

    for (const file of files) {
      const fileName = path.basename(file).toLowerCase();
      const folderName = path.dirname(file).split(path.sep).pop()?.toLowerCase() || '';
      
      let score = 0;
      const reasons: string[] = [];

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
      } catch {
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
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (item.score >= 8) {
        confidence = 'HIGH';
      } else if (item.score >= 5) {
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

  private static collectSourceFiles(dir: string, fileList: string[]): void {
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
        } else if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx', '.vue'].includes(ext)) {
            fileList.push(fullPath);
          }
        }
      }
    } catch {
      // ignore
    }
  }
}
