import { TrafficRecord } from "../models/types.js";
export interface HarParseResult {
    records: TrafficRecord[];
    skipped: number;
    errors: string[];
}
export declare function parseHar(rawJson: string): HarParseResult;
//# sourceMappingURL=HarParser.d.ts.map