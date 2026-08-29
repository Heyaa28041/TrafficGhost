let vscodeModule: any = null;
try {
  vscodeModule = require('vscode');
} catch {
  vscodeModule = null;
}

export class TrafficGhostLogger {
  private static instance: TrafficGhostLogger;
  private channel: any = null;

  private constructor() {
    try {
      if (vscodeModule && vscodeModule.window && vscodeModule.window.createOutputChannel) {
        this.channel = vscodeModule.window.createOutputChannel('TrafficGhost');
      }
    } catch {
      this.channel = null;
    }
  }

  public static getInstance(): TrafficGhostLogger {
    if (!TrafficGhostLogger.instance) {
      TrafficGhostLogger.instance = new TrafficGhostLogger();
    }
    return TrafficGhostLogger.instance;
  }

  public log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] [TrafficGhost] ${message}`;
    if (this.channel) {
      this.channel.appendLine(formatted);
    } else {
      console.log(formatted);
    }
  }

  public info(message: string): void {
    this.log(`INFO: ${message}`);
  }

  public warn(message: string): void {
    this.log(`WARN: ${message}`);
  }

  public error(message: string, error?: unknown): void {
    const errStr = error instanceof Error ? ` - ${error.message}\n${error.stack}` : error ? ` - ${String(error)}` : '';
    this.log(`ERROR: ${message}${errStr}`);
  }

  public show(): void {
    this.channel?.show(true);
  }
}

export const logger = TrafficGhostLogger.getInstance();
