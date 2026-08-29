import { QueryParameterDef, PaginationConfig } from '../models/endpoint';
import { CapturedRequest } from '../models/captured-request';
export declare class QueryAnalyzer {
    /**
     * Analyzes query parameters across a group of captured requests for an endpoint.
     */
    static analyzeQueryParams(requests: CapturedRequest[]): {
        queryParams: QueryParameterDef[];
        pagination?: PaginationConfig;
    };
    /**
     * Discovers the array path and aggregates items from captured responses.
     */
    static findArrayPayloads(requests: CapturedRequest[]): {
        itemsPath?: string;
        totalCountPath?: string;
        mergedItems: unknown[];
    };
}
