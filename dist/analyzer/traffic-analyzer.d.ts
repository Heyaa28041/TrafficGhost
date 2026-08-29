import { CapturedRequest } from '../models/captured-request';
import { TrafficGhostMockSchema } from '../models/endpoint';
export declare class TrafficAnalyzer {
    /**
     * Performs full traffic analysis on an array of captured requests.
     */
    static analyze(requests: CapturedRequest[]): TrafficGhostMockSchema;
    /**
     * Analyzes REST requests and groups them into parameterized endpoint definitions.
     */
    private static analyzeRest;
}
