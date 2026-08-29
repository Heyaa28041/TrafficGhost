// TrafficGhost — Mock Generator
// Converts EndpointModel[] into MockDefinition[] ready for the mock server.

import { EndpointModel, MockDefinition, BehaviorConfig } from "../models/types.js";
import { randomUUID } from "crypto";

export function generateMocks(endpoints: EndpointModel[]): MockDefinition[] {
  return endpoints.map((endpoint) => {
    // Sort responses: put 2xx first for the default response
    const sortedResponses = [...endpoint.examples].sort((a, b) => {
      const aOk = a.status >= 200 && a.status < 300 ? 0 : 1;
      const bOk = b.status >= 200 && b.status < 300 ? 0 : 1;
      return aOk - bOk;
    });

    const mock: MockDefinition = {
      id: randomUUID(),
      method: endpoint.method,
      path: endpoint.path,
      isDynamic: endpoint.isDynamic,
      responses: sortedResponses,
      behavior: { ...endpoint.behavior },
    };

    return mock;
  });
}

/** Merge default behavior with per-endpoint overrides */
export function applyBehaviorOverride(
  mock: MockDefinition,
  override: Partial<BehaviorConfig>
): MockDefinition {
  return {
    ...mock,
    behavior: {
      ...mock.behavior,
      ...override,
      errorRates: {
        ...mock.behavior.errorRates,
        ...(override.errorRates ?? {}),
      },
    },
  };
}
