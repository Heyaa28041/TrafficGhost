import { RouteParameter } from '../models/endpoint';

/**
 * Common non-dynamic path segments that should not be converted to parameters
 * unless strongly indicated by multiple variations.
 */
const STATIC_SEGMENT_EXCEPTIONS = new Set([
  'me', 'profile', 'count', 'search', 'settings', 'all', 'current',
  'health', 'status', 'login', 'logout', 'register', 'auth', 'oauth',
  'forgot-password', 'reset-password', 'sync', 'export', 'import',
  'batch', 'bulk', 'stats', 'metrics', 'config', 'schema', 'docs',
  'swagger', 'openapi', 'ping', 'version', 'info', 'v1', 'v2', 'v3',
  'api', 'graphql', 'rest'
]);

/**
 * Checks if a string segment is a dynamic identifier candidate.
 */
export function isDynamicSegmentCandidate(segment: string): { isDynamic: boolean; type: 'number' | 'uuid' | 'string' } {
  if (!segment || segment.length === 0) {
    return { isDynamic: false, type: 'string' };
  }

  // Pure integer (e.g. 1, 42, 99999)
  if (/^\d+$/.test(segment)) {
    return { isDynamic: true, type: 'number' };
  }

  // UUID v4 format (e.g. 123e4567-e89b-12d3-a456-426614174000)
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(segment)) {
    return { isDynamic: true, type: 'uuid' };
  }

  // MongoDB ObjectId or 24-char hex
  if (/^[0-9a-fA-F]{24}$/.test(segment)) {
    return { isDynamic: true, type: 'uuid' };
  }

  // Check if it looks like a hash or unique slug containing both letters and numbers and length > 6
  if (/^[a-zA-Z0-9_-]+$/.test(segment)) {
    const hasLetters = /[a-zA-Z]/.test(segment);
    const hasNumbers = /[0-9]/.test(segment);
    if (hasLetters && hasNumbers && segment.length >= 6 && !STATIC_SEGMENT_EXCEPTIONS.has(segment.toLowerCase())) {
      return { isDynamic: true, type: 'string' };
    }
  }

  return { isDynamic: false, type: 'string' };
}

/**
 * Derives a clean parameter name based on context (preceding segment).
 * e.g., 'users' -> 'id' (or 'userId' if multiple parameters exist).
 */
export function deriveParameterName(
  precedingSegment: string | undefined,
  existingParamNames: Set<string>
): string {
  if (!precedingSegment) {
    let name = 'id';
    let count = 1;
    while (existingParamNames.has(name)) {
      name = `id${++count}`;
    }
    existingParamNames.add(name);
    return name;
  }

  // Remove trailing 's' or 'es' to get singular form
  let singular = precedingSegment.toLowerCase();
  if (singular.endsWith('ies')) {
    singular = singular.slice(0, -3) + 'y';
  } else if (singular.endsWith('es') && !singular.endsWith('ses')) {
    singular = singular.slice(0, -2);
  } else if (singular.endsWith('s') && !singular.endsWith('ss')) {
    singular = singular.slice(0, -1);
  }

  let baseName = existingParamNames.has('id') ? `${singular}Id` : 'id';
  if (existingParamNames.has(baseName)) {
    baseName = `${singular}Id`;
  }

  let finalName = baseName;
  let counter = 1;
  while (existingParamNames.has(finalName)) {
    finalName = `${baseName}${++counter}`;
  }

  existingParamNames.add(finalName);
  return finalName;
}

export interface InferredRouteResult {
  pattern: string;
  parameters: RouteParameter[];
  rawPaths: string[];
}

export class RouteInferrer {
  /**
   * Groups a list of raw paths for the same HTTP method and infers dynamic route patterns.
   */
  public static inferRoutes(rawPaths: string[]): InferredRouteResult[] {
    const uniquePaths = Array.from(new Set(rawPaths.map((p) => p.trim()).filter(Boolean)));
    if (uniquePaths.length === 0) return [];

    // Segment each path: '/api/users/1' -> ['', 'api', 'users', '1']
    const pathSplits = uniquePaths.map((p) => ({
      raw: p,
      segments: p.split('/').map((s) => s.trim())
    }));

    // Group paths by their segment count
    const groupsByLength = new Map<number, Array<{ raw: string; segments: string[] }>>();
    for (const item of pathSplits) {
      const len = item.segments.length;
      if (!groupsByLength.has(len)) {
        groupsByLength.set(len, []);
      }
      groupsByLength.get(len)!.push(item);
    }

    const results: InferredRouteResult[] = [];

    // Analyze each group with same segment count
    for (const [len, items] of groupsByLength.entries()) {
      if (items.length === 1) {
        // Single path: check if any segment is an obvious dynamic ID
        const item = items[0];
        const patternSegments: string[] = [];
        const parameters: RouteParameter[] = [];
        const usedNames = new Set<string>();

        for (let i = 0; i < item.segments.length; i++) {
          const seg = item.segments[i];
          if (!seg) {
            patternSegments.push('');
            continue;
          }

          const candidate = isDynamicSegmentCandidate(seg);
          if (candidate.isDynamic && !STATIC_SEGMENT_EXCEPTIONS.has(seg.toLowerCase())) {
            const preceding = i > 0 ? item.segments[i - 1] : undefined;
            const paramName = deriveParameterName(preceding, usedNames);
            patternSegments.push(`:${paramName}`);
            parameters.push({
              name: paramName,
              position: i,
              inferredType: candidate.type,
              sampleValues: [seg]
            });
          } else {
            patternSegments.push(seg);
          }
        }

        results.push({
          pattern: patternSegments.join('/') || '/',
          parameters,
          rawPaths: [item.raw]
        });
        continue;
      }

      // Multiple paths with same length: find common prefix/suffix skeletons
      // Cluster items that share the same static skeleton
      const clusters = RouteInferrer.clusterPathsWithSameLength(items, len);
      for (const cluster of clusters) {
        results.push(cluster);
      }
    }

    return results;
  }

  /**
   * Clusters multiple paths of same length into inferred route patterns.
   */
  private static clusterPathsWithSameLength(
    items: Array<{ raw: string; segments: string[] }>,
    length: number
  ): InferredRouteResult[] {
    const results: InferredRouteResult[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < items.length; i++) {
      if (assigned.has(i)) continue;

      const clusterIndices = [i];
      const baseItem = items[i];

      // Find compatible items that differ only in dynamic-looking segments
      for (let j = i + 1; j < items.length; j++) {
        if (assigned.has(j)) continue;
        const candidate = items[j];

        let compatible = true;
        for (let s = 0; s < length; s++) {
          const segA = baseItem.segments[s];
          const segB = candidate.segments[s];

          if (segA !== segB) {
            // Must be dynamic candidates or both non-static exceptions
            const isDynA = isDynamicSegmentCandidate(segA).isDynamic;
            const isDynB = isDynamicSegmentCandidate(segB).isDynamic;
            const isStaticA = STATIC_SEGMENT_EXCEPTIONS.has(segA.toLowerCase());
            const isStaticB = STATIC_SEGMENT_EXCEPTIONS.has(segB.toLowerCase());

            if ((!isDynA && !isDynB) || isStaticA || isStaticB) {
              compatible = false;
              break;
            }
          }
        }

        if (compatible) {
          clusterIndices.push(j);
        }
      }

      // Mark all in cluster as assigned
      for (const idx of clusterIndices) {
        assigned.add(idx);
      }

      const clusterItems = clusterIndices.map((idx) => items[idx]);
      const patternSegments: string[] = [];
      const parameters: RouteParameter[] = [];
      const usedNames = new Set<string>();

      for (let s = 0; s < length; s++) {
        const sampleValues = Array.from(new Set(clusterItems.map((c) => c.segments[s])));
        const firstVal = sampleValues[0];

        if (!firstVal) {
          patternSegments.push('');
          continue;
        }

        if (sampleValues.length === 1) {
          // Check if it's a single value that is clearly a dynamic ID
          const dynCheck = isDynamicSegmentCandidate(firstVal);
          if (dynCheck.isDynamic && !STATIC_SEGMENT_EXCEPTIONS.has(firstVal.toLowerCase())) {
            const preceding = s > 0 ? patternSegments[s - 1].replace(/^:/, '') : undefined;
            const paramName = deriveParameterName(preceding, usedNames);
            patternSegments.push(`:${paramName}`);
            parameters.push({
              name: paramName,
              position: s,
              inferredType: dynCheck.type,
              sampleValues
            });
          } else {
            patternSegments.push(firstVal);
          }
        } else {
          // Multiple distinct values in this segment -> dynamic parameter!
          const preceding = s > 0 ? patternSegments[s - 1].replace(/^:/, '') : undefined;
          const paramName = deriveParameterName(preceding, usedNames);
          patternSegments.push(`:${paramName}`);

          const types = sampleValues.map((v) => isDynamicSegmentCandidate(v).type);
          const inferredType = types.every((t) => t === 'number')
            ? 'number'
            : types.every((t) => t === 'uuid')
            ? 'uuid'
            : 'string';

          parameters.push({
            name: paramName,
            position: s,
            inferredType,
            sampleValues
          });
        }
      }

      results.push({
        pattern: patternSegments.join('/') || '/',
        parameters,
        rawPaths: clusterItems.map((c) => c.raw)
      });
    }

    return results;
  }
}
