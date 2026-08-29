"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.TrafficGhostLogger = void 0;
let vscodeModule = null;
try {
    vscodeModule = require('vscode');
}
catch {
    vscodeModule = null;
}
class TrafficGhostLogger {
    static instance;
    channel = null;
    constructor() {
        try {
            if (vscodeModule && vscodeModule.window && vscodeModule.window.createOutputChannel) {
                this.channel = vscodeModule.window.createOutputChannel('TrafficGhost');
            }
        }
        catch {
            this.channel = null;
        }
    }
    static getInstance() {
        if (!TrafficGhostLogger.instance) {
            TrafficGhostLogger.instance = new TrafficGhostLogger();
        }
        return TrafficGhostLogger.instance;
    }
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const formatted = `[${timestamp}] [TrafficGhost] ${message}`;
        if (this.channel) {
            this.channel.appendLine(formatted);
        }
        else {
            console.log(formatted);
        }
    }
    info(message) {
        this.log(`INFO: ${message}`);
    }
    warn(message) {
        this.log(`WARN: ${message}`);
    }
    error(message, error) {
        const errStr = error instanceof Error ? ` - ${error.message}\n${error.stack}` : error ? ` - ${String(error)}` : '';
        this.log(`ERROR: ${message}${errStr}`);
    }
    show() {
        this.channel?.show(true);
    }
}
exports.TrafficGhostLogger = TrafficGhostLogger;
exports.logger = TrafficGhostLogger.getInstance();
//# sourceMappingURL=output-channel.js.map