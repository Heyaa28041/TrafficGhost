import { EventEmitter } from 'events';
import { CapturedRequest } from '../models/captured-request';
export interface CdpTarget {
    id: string;
    title: string;
    type: string;
    url: string;
    webSocketDebuggerUrl?: string;
}
export declare class BrowserRecorder extends EventEmitter {
    private isRecording;
    private ws;
    private browserProcess;
    private messageId;
    private pendingCdpRequests;
    private activeRequests;
    private capturedRequests;
    private redactHeaderNames;
    private cdpPort;
    constructor(cdpPort?: number, redactHeadersList?: string[]);
    getIsRecording(): boolean;
    getCapturedRequests(): CapturedRequest[];
    clearCaptured(): void;
    /**
     * Starts browser recording session by connecting to Chrome CDP or launching a debugging instance.
     */
    startRecording(targetUrl?: string): Promise<boolean>;
    /**
     * Stops the browser recording session and returns all captured requests.
     */
    stopRecording(): Promise<CapturedRequest[]>;
    private findCdpTarget;
    private launchChrome;
    private connectCdpWebSocket;
    private sendCdpCommand;
    private handleCdpEvent;
}
