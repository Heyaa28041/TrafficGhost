import { BehaviorConfig, MockDefinition, ResponseExample } from "../models/types.js";
export interface BehaviorResult {
    response: ResponseExample;
    appliedLatencyMs: number;
    injected: boolean;
}
export declare class BehaviorEngine {
    private globalBehavior;
    private chaosMode;
    private chaosBehavior;
    setGlobalBehavior(config: BehaviorConfig): void;
    setChaosMode(enabled: boolean, config?: BehaviorConfig): void;
    isChaosMode(): boolean;
    getGlobalBehavior(): BehaviorConfig;
    applyBehavior(mock: MockDefinition): Promise<BehaviorResult>;
    private mergeBehavior;
    private resolveLatency;
    private evaluateErrorInjection;
}
//# sourceMappingURL=BehaviorEngine.d.ts.map