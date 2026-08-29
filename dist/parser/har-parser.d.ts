import { CapturedRequest } from '../models/captured-request';
/**
 * Raw HAR 1.2 Structure Interfaces
 */
interface HarLogEntry {
    startedDateTime?: string;
    time?: number;
    request?: {
        method?: string;
        url?: string;
        httpVersion?: string;
        headers?: Array<{
            name: string;
            value: string;
        }>;
        queryString?: Array<{
            name: string;
            value: string;
        }>;
        postData?: {
            mimeType?: string;
            text?: string;
            params?: Array<{
                name: string;
                value?: string;
            }>;
        };
        headersSize?: number;
        bodySize?: number;
    };
    response?: {
        status?: number;
        statusText?: string;
        httpVersion?: string;
        headers?: Array<{
            name: string;
            value: string;
        }>;
        content?: {
            size?: number;
            mimeType?: string;
            text?: string;
            encoding?: string;
        };
        headersSize?: number;
        bodySize?: number;
    };
    timings?: {
        blocked?: number;
        dns?: number;
        connect?: number;
        send?: number;
        wait?: number;
        receive?: number;
        ssl?: number;
    };
}
export declare class HarParser {
    /**
     * Parses raw HAR JSON string into an array of normalized CapturedRequests.
     */
    static parse(harJsonContent: string, redactHeaderNames?: string[]): CapturedRequest[];
    /**
     * Normalizes a single HAR log entry into a CapturedRequest.
     */
    static normalizeEntry(entry: HarLogEntry, index: number, redactHeaderNames?: string[]): CapturedRequest | null;
}
export {};
