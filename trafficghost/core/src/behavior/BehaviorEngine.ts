// TrafficGhost — Behavior Engine
// Applies latency and error injection to every mock server request.

import { BehaviorConfig, MockDefinition, ResponseExample } from "../models/types.js";

export interface BehaviorResult {
  response: ResponseExample;
  appliedLatencyMs: number;
  injected: boolean; // true if an error was injected (not from recorded response)
}

export class BehaviorEngine {
  private globalBehavior: BehaviorConfig = {};
  private chaosMode = false;
  private chaosBehavior: BehaviorConfig = {
    latencyMs: 1000,
    errorRates: { 500: 0.2, 429: 0.1 },
  };

  setGlobalBehavior(config: BehaviorConfig): void {
    this.globalBehavior = config;
  }

  setChaosMode(enabled: boolean, config?: BehaviorConfig): void {
    this.chaosMode = enabled;
    if (config) this.chaosBehavior = config;
  }

  isChaosMode(): boolean {
    return this.chaosMode;
  }

  getGlobalBehavior(): BehaviorConfig {
    return this.globalBehavior;
  }

  async applyBehavior(mock: MockDefinition): Promise<BehaviorResult> {
    // Merge: chaos > per-endpoint > global
    const effective = this.mergeBehavior(
      this.chaosMode ? this.chaosBehavior : {},
      mock.behavior,
      this.globalBehavior
    );

    // Apply latency
    const latencyMs = this.resolveLatency(effective);
    if (latencyMs > 0) {
      await sleep(latencyMs);
    }

    // Evaluate error injection
    const injectedError = this.evaluateErrorInjection(effective.errorRates);
    if (injectedError !== null) {
      return {
        response: makeErrorResponse(injectedError),
        appliedLatencyMs: latencyMs,
        injected: true,
      };
    }

    // Return the primary (first/default) response
    const response = mock.responses[0] ?? makeErrorResponse(500);
    return {
      response,
      appliedLatencyMs: latencyMs,
      injected: false,
    };
  }

  private mergeBehavior(...configs: BehaviorConfig[]): BehaviorConfig {
    // Later entries take precedence (higher priority = listed earlier in args)
    const result: BehaviorConfig = { errorRates: {} };
    for (const config of [...configs].reverse()) {
      if (config.latencyMs !== undefined) result.latencyMs = config.latencyMs;
      if (config.latencyRandom !== undefined) result.latencyRandom = config.latencyRandom;
      for (const [code, rate] of Object.entries(config.errorRates ?? {})) {
        (result.errorRates as Record<string, number>)[code] = rate as number;
      }
    }
    return result;
  }

  private resolveLatency(config: BehaviorConfig): number {
    if (!config.latencyMs) return 0;
    if (config.latencyRandom) {
      return Math.floor(Math.random() * config.latencyMs);
    }
    return config.latencyMs;
  }

  private evaluateErrorInjection(
    errorRates?: BehaviorConfig["errorRates"]
  ): number | null {
    if (!errorRates) return null;
    const rand = Math.random();
    let cumulative = 0;

    // Evaluate in order: 500, 429, 404, 502, 503
    const order = [500, 429, 404, 502, 503] as const;
    for (const code of order) {
      const rate = errorRates[code] ?? 0;
      if (rate > 0) {
        cumulative += rate;
        if (rand < cumulative) {
          return code;
        }
      }
    }
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ERROR_BODIES: Record<number, unknown> = {
  400: { error: "Bad Request", message: "The request was malformed." },
  401: { error: "Unauthorized", message: "Authentication required." },
  403: { error: "Forbidden", message: "You do not have permission to access this resource." },
  404: { error: "Not Found", message: "The requested resource was not found." },
  408: { error: "Request Timeout", message: "The request timed out." },
  409: { error: "Conflict", message: "The request conflicts with the current state." },
  429: { error: "Too Many Requests", message: "Rate limit exceeded. Try again later.", retryAfter: 60 },
  500: { error: "Internal Server Error", message: "TrafficGhost injected a 500 error." },
  502: { error: "Bad Gateway", message: "Upstream service unavailable." },
  503: { error: "Service Unavailable", message: "Service temporarily unavailable." },
  504: { error: "Gateway Timeout", message: "Upstream service timed out." },
};

function makeErrorResponse(status: number): ResponseExample {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: ERROR_BODIES[status] ?? { error: `HTTP ${status}` },
  };
}
