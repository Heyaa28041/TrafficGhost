import { RouteParameter } from '../models/endpoint';
/**
 * Checks if a string segment is a dynamic identifier candidate.
 */
export declare function isDynamicSegmentCandidate(segment: string): {
    isDynamic: boolean;
    type: 'number' | 'uuid' | 'string';
};
/**
 * Derives a clean parameter name based on context (preceding segment).
 * e.g., 'users' -> 'id' (or 'userId' if multiple parameters exist).
 */
export declare function deriveParameterName(precedingSegment: string | undefined, existingParamNames: Set<string>): string;
export interface InferredRouteResult {
    pattern: string;
    parameters: RouteParameter[];
    rawPaths: string[];
}
export declare class RouteInferrer {
    /**
     * Groups a list of raw paths for the same HTTP method and infers dynamic route patterns.
     */
    static inferRoutes(rawPaths: string[]): InferredRouteResult[];
    /**
     * Clusters multiple paths of same length into inferred route patterns.
     */
    private static clusterPathsWithSameLength;
}
