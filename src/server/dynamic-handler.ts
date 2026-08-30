import { RestEndpointDefinition, MockResponseVariant } from '../models/endpoint';

export class DynamicHandler {
  /**
   * Selects the best matching response variant based on request query parameters.
   */
  public static selectResponseVariant(
    endpoint: RestEndpointDefinition,
    requestQuery: Record<string, string>,
    reqBody?: any
  ): MockResponseVariant {
    if (!endpoint.responses || endpoint.responses.length === 0) {
      return endpoint.defaultResponse;
    }

    if (endpoint.responses.length === 1) {
      return endpoint.responses[0];
    }

    let normalizedBody = reqBody;
    if (typeof reqBody === 'string') {
      try {
        normalizedBody = JSON.parse(reqBody);
      } catch {
        normalizedBody = reqBody;
      }
    }

    // 1. Try matching request body fields (for POST/PUT/PATCH mutations)
    if (normalizedBody && typeof normalizedBody === 'object') {
      for (const variant of endpoint.responses) {
        if (!variant.matchBody) continue;

        const matchKeys = Object.keys(variant.matchBody);
        if (matchKeys.length === 0 && Object.keys(normalizedBody).length > 0) continue;

        let bodyMatch = true;
        for (const [k, v] of Object.entries(variant.matchBody)) {
          if (JSON.stringify(normalizedBody[k]) !== JSON.stringify(v)) {
            bodyMatch = false;
            break;
          }
        }

        if (bodyMatch) {
          return variant;
        }
      }
    }

    if (!normalizedBody || (typeof normalizedBody === 'object' && Object.keys(normalizedBody).length === 0)) {
      const emptyBodyVariant = endpoint.responses.find(
        (variant) => variant.matchBody && Object.keys(variant.matchBody).length === 0
      );
      if (emptyBodyVariant) return emptyBodyVariant;
    }

    // 2. Try matching query parameters
    for (const variant of endpoint.responses) {
      if (!variant.matchQuery || Object.keys(variant.matchQuery).length === 0) continue;

      let allMatch = true;
      for (const [k, v] of Object.entries(variant.matchQuery)) {
        if (requestQuery[k] !== v) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        return variant;
      }
    }

    return endpoint.defaultResponse || endpoint.responses[0];
  }

  /**
   * Generates a realistic dynamic response by replacing path parameters and applying pagination.
   */
  public static generateDynamicResponse(
    endpoint: RestEndpointDefinition,
    pathParams: Record<string, string>,
    queryParams: Record<string, string>,
    baseBody: unknown,
    emptyPayload = false
  ): unknown {
    if (emptyPayload) {
      return DynamicHandler.generateEmptyPayload(baseBody, endpoint);
    }

    let result = JSON.parse(JSON.stringify(baseBody));

    // 1. Apply Dynamic Path Parameter Interpolation
    if (Object.keys(pathParams).length > 0 && result && typeof result === 'object') {
      result = DynamicHandler.interpolatePathParameters(result, pathParams);
    }

    // 2. Apply Dynamic Pagination if endpoint has pagination config
    if (endpoint.pagination?.enabled && result) {
      result = DynamicHandler.applyPagination(result, endpoint, queryParams);
    }

    return result;
  }

  /**
   * Recursively replaces ID / parameter fields with the requested path parameter values.
   */
  public static interpolatePathParameters(
    obj: unknown,
    params: Record<string, string>
  ): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => DynamicHandler.interpolatePathParameters(item, params));
    }

    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const cloned = { ...(obj as Record<string, unknown>) };

    for (const [paramName, paramVal] of Object.entries(params)) {
      const isNum = /^\d+$/.test(paramVal);
      const valToInsert = isNum ? parseInt(paramVal, 10) : paramVal;

      // Check matching property keys: id, _id, paramName, paramNameId, etc.
      const candidateKeys = [
        paramName,
        'id',
        '_id',
        `${paramName}Id`,
        paramName.replace(/Id$/, '')
      ];

      for (const key of candidateKeys) {
        if (key in cloned && (typeof cloned[key] === 'string' || typeof cloned[key] === 'number')) {
          cloned[key] = valToInsert;
        }
      }

      // Check nested objects (e.g. user: { id: ... }, data: { id: ... })
      for (const [k, v] of Object.entries(cloned)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          cloned[k] = DynamicHandler.interpolatePathParameters(v, params);
        }
      }
    }

    return cloned;
  }

  /**
   * Dynamically slices and computes paginated response items and counts.
   */
  public static applyPagination(
    body: unknown,
    endpoint: RestEndpointDefinition,
    queryParams: Record<string, string>
  ): unknown {
    const pConfig = endpoint.pagination;
    if (!pConfig) return body;

    // Determine requested page / limit / offset
    const pageKey = pConfig.pageParam || 'page';
    const limitKey = pConfig.limitParam || pConfig.pageSizeParam || 'limit';
    const offsetKey = pConfig.offsetParam || 'offset';

    const pageStr = queryParams[pageKey] || queryParams['page'] || queryParams['p'];
    const limitStr = queryParams[limitKey] || queryParams['limit'] || queryParams['pageSize'] || queryParams['per_page'];
    const offsetStr = queryParams[offsetKey] || queryParams['offset'] || queryParams['skip'];

    let page = pageStr ? parseInt(pageStr, 10) : 1;
    if (isNaN(page) || page < 1) page = 1;

    let limit = limitStr ? parseInt(limitStr, 10) : 10;
    if (isNaN(limit) || limit < 1) limit = 10;

    let offset = offsetStr ? parseInt(offsetStr, 10) : (page - 1) * limit;
    if (isNaN(offset) || offset < 0) offset = 0;

    const allItems = pConfig.allCapturedItems && pConfig.allCapturedItems.length > 0
      ? pConfig.allCapturedItems
      : DynamicHandler.extractItemsArray(body, pConfig.itemsPath);

    if (!allItems || allItems.length === 0) {
      return body;
    }

    // Expand items if requested page exceeds captured items to simulate infinite mock dataset
    let dataset = [...allItems];
    if (offset + limit > dataset.length && dataset.length > 0) {
      const needed = offset + limit;
      while (dataset.length < needed && dataset.length < 500) {
        const itemIndex = dataset.length + 1;
        const template = dataset[(itemIndex - 1) % allItems.length];
        const syntheticItem = DynamicHandler.generateSyntheticItem(template, itemIndex);
        dataset.push(syntheticItem);
      }
    }

    const totalCount = Math.max(dataset.length, 50);
    const sliced = dataset.slice(offset, offset + limit);

    if (pConfig.itemsPath === '') {
      // Root is array
      return sliced;
    }

    if (typeof body === 'object' && body !== null) {
      const cloned = { ...(body as Record<string, unknown>) };
      const itemsKey = pConfig.itemsPath || 'data';
      cloned[itemsKey] = sliced;

      if (pConfig.totalCountPath) {
        cloned[pConfig.totalCountPath] = totalCount;
      } else if ('total' in cloned) {
        cloned['total'] = totalCount;
      } else if ('totalCount' in cloned) {
        cloned['totalCount'] = totalCount;
      }

      if ('page' in cloned) cloned['page'] = page;
      if ('currentPage' in cloned) cloned['currentPage'] = page;
      if ('limit' in cloned) cloned['limit'] = limit;
      if ('pageSize' in cloned) cloned['pageSize'] = limit;
      if ('totalPages' in cloned) cloned['totalPages'] = Math.ceil(totalCount / limit);

      return cloned;
    }

    return body;
  }

  private static extractItemsArray(body: unknown, itemsPath?: string): unknown[] {
    if (Array.isArray(body)) return body;
    if (typeof body === 'object' && body !== null) {
      const obj = body as Record<string, unknown>;
      if (itemsPath && Array.isArray(obj[itemsPath])) {
        return obj[itemsPath] as unknown[];
      }
      for (const k of ['data', 'items', 'results', 'users', 'products', 'orders']) {
        if (Array.isArray(obj[k])) return obj[k] as unknown[];
      }
    }
    return [];
  }

  private static generateSyntheticItem(template: unknown, newId: number): unknown {
    if (typeof template !== 'object' || template === null) return template;
    const cloned = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
    if ('id' in cloned) {
      cloned['id'] = typeof cloned['id'] === 'number' ? newId : `item_${newId}`;
    }
    if ('title' in cloned && typeof cloned['title'] === 'string') {
      cloned['title'] = `${cloned['title'].replace(/\s+\d+$/, '')} ${newId}`;
    }
    if ('name' in cloned && typeof cloned['name'] === 'string') {
      cloned['name'] = `${cloned['name'].replace(/\s+\d+$/, '')} ${newId}`;
    }
    return cloned;
  }

  private static generateEmptyPayload(baseBody: unknown, endpoint?: RestEndpointDefinition): unknown {
    if (Array.isArray(baseBody)) return [];
    if (typeof baseBody === 'object' && baseBody !== null) {
      const cloned = { ...(baseBody as Record<string, unknown>) };
      const itemsKey = endpoint?.pagination?.itemsPath || 'data';
      for (const k of Object.keys(cloned)) {
        if (Array.isArray(cloned[k])) {
          cloned[k] = [];
        } else if (k === 'total' || k === 'totalCount' || k === 'count') {
          cloned[k] = 0;
        }
      }
      if (itemsKey && !(itemsKey in cloned)) {
        cloned[itemsKey] = [];
      }
      return cloned;
    }
    return {};
  }
}
