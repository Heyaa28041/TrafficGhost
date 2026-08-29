"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.DEFAULT_CONFIG = {
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
//# sourceMappingURL=config.js.map