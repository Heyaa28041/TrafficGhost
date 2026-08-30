/**
 * Scans the VS Code workspace line by line to detect where APIs are referenced.
 *
 * Connected to:
 *   - src/extension.ts (commands: findApiUsage, openApiUsage)
 *   - src/providers/api-hover-provider.ts (hover shows usages count)
 *   - src/providers/api-codelens-provider.ts (codelens shows usages)
 *   - src/views/dashboard-panel.ts (webview receives scanned usage map)
 */

import * as fs from 'fs';
import * as path from 'path';
import { TrafficGhostMockSchema } from '../models/endpoint';

export interface ApiUsageMatch {
  filePath: string;
  lineNumber: number; // 1-based
  lineContent: string;
  confidence: 'CONFIRMED' | 'LIKELY' | 'POSSIBLE';
  usageType?: 'fetch' | 'axios' | 'wrapper' | 'other';
}

export interface ApiUsageResult {
  endpointId: string;
  method: string;
  pathPattern: string;
  usages: ApiUsageMatch[];
  lastScannedAt: string;
}

export class WorkspaceScanner {
  private static cache: Map<string, ApiUsageResult> = new Map();

  public static clearCache(): void {
    this.cache.clear();
  }

  public static getCached(endpointId: string): ApiUsageResult | null {
    return this.cache.get(endpointId) || null;
  }

  /**
   * Scans all files in the workspace for references to this REST endpoint.
   */
  public static async scanForEndpoint(
    endpointId: string,
    method: string,
    pathPattern: string,
    workspaceRoot: string
  ): Promise<ApiUsageResult> {
    const cacheKey = `${endpointId}_${method}_${pathPattern}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result: ApiUsageResult = {
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

    if (segments.length === 0) return result;

    const filesToScan: string[] = [];
    this.scanDirRecursive(workspaceRoot, filesToScan);

    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content) continue;

        // Fast check before parsing lines
        const hasMatch = segments.some(seg => content.includes(seg)) || content.includes(cleanPattern);
        if (!hasMatch) continue;

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
          
          let usageType: 'fetch' | 'axios' | 'wrapper' | 'other' = 'other';
          if (line.includes('fetch(') || line.includes('fetch ')) {
            usageType = 'fetch';
          } else if (line.includes('axios') || line.includes('axios.')) {
            usageType = 'axios';
          } else if (/api\.|client\.|request\.|http\./.test(line)) {
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
          } else {
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
      } catch (err) {
        // ignore read/access errors
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Scan all endpoints in a schema.
   */
  public static async scanAllEndpoints(
    schema: TrafficGhostMockSchema,
    workspaceRoot: string
  ): Promise<ApiUsageResult[]> {
    if (!schema) return [];
    const results: ApiUsageResult[] = [];
    for (const ep of schema.restEndpoints) {
      const res = await this.scanForEndpoint(ep.id, ep.method, ep.pathPattern, workspaceRoot);
      results.push(res);
    }
    return results;
  }

  private static scanDirRecursive(dir: string, fileList: string[]): void {
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
