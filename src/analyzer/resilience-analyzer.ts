/**
 * Statically analyzes frontend integration code to identify error-handling and resilience gaps.
 *
 * Connected to:
 *   - src/extension.ts           — commands (resilience gap checks)
 *   - src/views/dashboard-panel.ts — passes stats to Dashboard Webview
 */

import * as fs from 'fs';
import { ApiUsageMatch } from './workspace-scanner';

export interface ResilienceReport {
  usagesAnalyzed: number;
  loadingDetected: boolean;
  errorDetected: boolean;
  statusChecked: boolean;
  statusGaps: { code: number; label: string; status: 'handled' | 'potentially handled' | 'NOT DETECTED' }[];
  reasons: string[];
}

export class ResilienceAnalyzer {
  /**
   * Analyzes list of usages for an endpoint.
   */
  public static analyzeUsages(usages: ApiUsageMatch[]): ResilienceReport {
    const report: ResilienceReport = {
      usagesAnalyzed: usages.length,
      loadingDetected: false,
      errorDetected: false,
      statusChecked: false,
      statusGaps: [
        { code: 200, label: 'Success', status: 'NOT DETECTED' },
        { code: 401, label: 'Unauthorized', status: 'NOT DETECTED' },
        { code: 429, label: 'Rate Limiting', status: 'NOT DETECTED' },
        { code: 500, label: 'Server Error', status: 'NOT DETECTED' }
      ],
      reasons: []
    };

    if (usages.length === 0) {
      report.reasons.push('No frontend integration files detected. API is completely unintegrated.');
      return report;
    }

    let rawWindows = '';

    for (const match of usages) {
      try {
        const fileContent = fs.readFileSync(match.filePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        // Extract window: line number is 1-based, get 5 lines before and 25 lines after
        const start = Math.max(0, match.lineNumber - 6);
        const end = Math.min(lines.length, match.lineNumber + 25);
        const windowText = lines.slice(start, end).join('\n').toLowerCase();
        
        rawWindows += '\n' + windowText;
      } catch {
        // ignore
      }
    }

    if (!rawWindows) return report;

    // 1. Check loading state patterns
    if (/loading|isloading|setloading|spinner|skeleton|pending/i.test(rawWindows)) {
      report.loadingDetected = true;
    } else {
      report.reasons.push('Could not detect explicit Loading state handler (e.g. isLoading, spinner, skeleton)');
    }

    // 2. Check error handling patterns
    if (/catch|err|error|seterror|\.catch/i.test(rawWindows)) {
      report.errorDetected = true;
    } else {
      report.reasons.push('Potential missing general Error handler (try/catch block or .catch helper missing)');
    }

    // 3. Check status code checks
    if (/status|response\.ok|res\.ok|\.status/i.test(rawWindows)) {
      report.statusChecked = true;
    }

    // Check specific HTTP status targets
    report.statusGaps = report.statusGaps.map(item => {
      let status: 'handled' | 'potentially handled' | 'NOT DETECTED' = 'NOT DETECTED';
      const hasSpecificCode = rawWindows.includes(String(item.code));
      
      if (item.code === 200) {
        const hasSuccess = hasSpecificCode || rawWindows.includes('ok') || rawWindows.includes('then') || rawWindows.includes('await');
        status = hasSuccess ? 'handled' : 'NOT DETECTED';
      } else {
        if (hasSpecificCode) {
          status = 'handled';
        } else {
          // If general error catch exists, it is "potentially handled"
          status = report.errorDetected ? 'potentially handled' : 'NOT DETECTED';
        }
      }

      return { ...item, status };
    });

    // Compile reasons for gaps
    report.statusGaps.forEach(item => {
      if (item.status === 'NOT DETECTED') {
        report.reasons.push(`Potential missing ${item.code} (${item.label}) status checks`);
      } else if (item.status === 'potentially handled') {
        report.reasons.push(`Could not detect explicit ${item.code} handling, fallback to generic catch`);
      }
    });

    return report;
  }
}
