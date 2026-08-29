import { QueryParameterDef, PaginationConfig } from '../models/endpoint';
import { CapturedRequest } from '../models/captured-request';

const PAGINATION_PARAM_PATTERNS: Record<string, 'page' | 'pageSize' | 'limit' | 'offset' | 'cursor'> = {
  'page': 'page',
  'p': 'page',
  'pagenum': 'page',
  'page_number': 'page',
  'currentpage': 'page',
  'pagesize': 'pageSize',
  'per_page': 'pageSize',
  'perpage': 'pageSize',
  'size': 'pageSize',
  'limit': 'limit',
  'take': 'limit',
  'offset': 'offset',
  'skip': 'offset',
  'cursor': 'cursor',
  'after': 'cursor',
  'before': 'cursor',
  'next': 'cursor',
  'nexttoken': 'cursor'
};

export class QueryAnalyzer {
  /**
   * Analyzes query parameters across a group of captured requests for an endpoint.
   */
  public static analyzeQueryParams(requests: CapturedRequest[]): {
    queryParams: QueryParameterDef[];
    pagination?: PaginationConfig;
  } {
    const paramMap = new Map<string, {
      values: Set<string>;
      paginationType?: 'page' | 'pageSize' | 'limit' | 'offset' | 'cursor';
    }>();

    for (const req of requests) {
      for (const [key, val] of Object.entries(req.query)) {
        if (!paramMap.has(key)) {
          const lowerKey = key.toLowerCase();
          const pType = PAGINATION_PARAM_PATTERNS[lowerKey];
          paramMap.set(key, {
            values: new Set(),
            paginationType: pType
          });
        }

        const entry = paramMap.get(key)!;
        if (Array.isArray(val)) {
          val.forEach((v) => entry.values.add(v));
        } else if (val !== undefined && val !== null) {
          entry.values.add(String(val));
        }
      }
    }

    const queryParams: QueryParameterDef[] = [];
    let pageParam: string | undefined;
    let pageSizeParam: string | undefined;
    let limitParam: string | undefined;
    let offsetParam: string | undefined;
    let cursorParam: string | undefined;

    for (const [name, info] of paramMap.entries()) {
      const isPagination = Boolean(info.paginationType);
      if (info.paginationType === 'page') pageParam = name;
      if (info.paginationType === 'pageSize') pageSizeParam = name;
      if (info.paginationType === 'limit') limitParam = name;
      if (info.paginationType === 'offset') offsetParam = name;
      if (info.paginationType === 'cursor') cursorParam = name;

      queryParams.push({
        name,
        isPagination,
        paginationType: info.paginationType,
        sampleValues: Array.from(info.values)
      });
    }

    let pagination: PaginationConfig | undefined;
    const hasPaginationParams = Boolean(pageParam || limitParam || offsetParam || cursorParam);

    if (hasPaginationParams) {
      // Find array items in response payloads
      const arrayAnalysis = QueryAnalyzer.findArrayPayloads(requests);
      pagination = {
        enabled: true,
        pageParam,
        pageSizeParam,
        limitParam,
        offsetParam,
        cursorParam,
        itemsPath: arrayAnalysis.itemsPath,
        totalCountPath: arrayAnalysis.totalCountPath,
        allCapturedItems: arrayAnalysis.mergedItems
      };
    }

    return { queryParams, pagination };
  }

  /**
   * Discovers the array path and aggregates items from captured responses.
   */
  public static findArrayPayloads(requests: CapturedRequest[]): {
    itemsPath?: string;
    totalCountPath?: string;
    mergedItems: unknown[];
  } {
    const mergedItems: unknown[] = [];
    let discoveredItemsPath: string | undefined;
    let discoveredTotalCountPath: string | undefined;

    for (const req of requests) {
      const body = req.response.body;
      if (!body) continue;

      if (Array.isArray(body)) {
        discoveredItemsPath = '';
        for (const item of body) {
          if (!mergedItems.some((m) => JSON.stringify(m) === JSON.stringify(item))) {
            mergedItems.push(item);
          }
        }
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        // Common collection property names: data, items, results, users, products, orders, records, etc.
        const candidateKeys = ['data', 'items', 'results', 'records', 'users', 'products', 'orders', 'list', 'content'];
        for (const key of candidateKeys) {
          if (Array.isArray(obj[key])) {
            discoveredItemsPath = key;
            for (const item of obj[key] as unknown[]) {
              if (!mergedItems.some((m) => JSON.stringify(m) === JSON.stringify(item))) {
                mergedItems.push(item);
              }
            }
            break;
          }
        }

        // Detect total count key
        const totalKeys = ['total', 'totalCount', 'total_count', 'count', 'totalItems', 'total_items'];
        for (const key of totalKeys) {
          if (typeof obj[key] === 'number') {
            discoveredTotalCountPath = key;
            break;
          }
        }
      }
    }

    return {
      itemsPath: discoveredItemsPath,
      totalCountPath: discoveredTotalCountPath,
      mergedItems
    };
  }
}
