import { EndpointModel, MockDefinition, BehaviorConfig } from "../models/types.js";
export declare function generateMocks(endpoints: EndpointModel[]): MockDefinition[];
/** Merge default behavior with per-endpoint overrides */
export declare function applyBehaviorOverride(mock: MockDefinition, override: Partial<BehaviorConfig>): MockDefinition;
//# sourceMappingURL=MockGenerator.d.ts.map