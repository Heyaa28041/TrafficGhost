import { ScenarioType } from './scenario';

/**
 * TrafficGhost Project Configuration stored in trafficghost/config.json
 */
export interface TrafficGhostConfig {
  version: string;
  port: number;
  globalScenario: ScenarioType;
  latency: {
    enabled: boolean;
    min: number;
    max: number;
  };
  pagination: {
    enabled: boolean;
  };
  errors: {
    enabled: boolean;
  };
  redactHeaders: string[];
}

export const DEFAULT_CONFIG: TrafficGhostConfig = {
  version: '1.0.0',
  port: 4000,
  globalScenario: 'normal',
  latency: {
    enabled: false,
    min: 100,
    max: 500
  },
  pagination: {
    enabled: true
  },
  errors: {
    enabled: true
  },
  redactHeaders: [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'apikey',
    'proxy-authorization',
    'x-auth-token'
  ]
};
