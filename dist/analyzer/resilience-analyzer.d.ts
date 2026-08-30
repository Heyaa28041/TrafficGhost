/**
 * Statically analyzes frontend integration code to identify error-handling and resilience gaps.
 *
 * Connected to:
 *   - src/extension.ts           — commands (resilience gap checks)
 *   - src/views/dashboard-panel.ts — passes stats to Dashboard Webview
 */
import { ApiUsageMatch } from './workspace-scanner';
export interface ResilienceReport {
    usagesAnalyzed: number;
    loadingDetected: boolean;
    errorDetected: boolean;
    statusChecked: boolean;
    statusGaps: {
        code: number;
        label: string;
        status: 'handled' | 'potentially handled' | 'NOT DETECTED';
    }[];
    reasons: string[];
}
export declare class ResilienceAnalyzer {
    /**
     * Analyzes list of usages for an endpoint.
     */
    static analyzeUsages(usages: ApiUsageMatch[]): ResilienceReport;
}
