export declare class TrafficGhostLogger {
    private static instance;
    private channel;
    private constructor();
    static getInstance(): TrafficGhostLogger;
    log(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
    show(): void;
}
export declare const logger: TrafficGhostLogger;
