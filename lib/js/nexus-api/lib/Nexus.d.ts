import * as types from './types';
export declare class NexusError extends Error {
    private mStatusCode;
    private mRequest;
    constructor(message: string, statusCode: number, url: string);
    readonly statusCode: number;
    readonly request: string;
}
export declare class TimeoutError extends Error {
    constructor(message: any);
}
export declare class HTTPError extends Error {
    private mBody;
    constructor(statusCode: number, message: string, body: string);
    readonly body: string;
}
declare class Nexus {
    private mBaseData;
    private mBaseURL;
    private mQuota;
    constructor(game: string, apiKey: string, timeout?: number);
    setGame(gameId: string): void;
    setKey(apiKey: string): void;
    validateKey(key?: string): Promise<types.IValidateKeyResponse>;
    endorseMod(modId: number, modVersion: string, endorseStatus: string, gameId?: string): Promise<any>;
    getGames(): Promise<types.IGameListEntry[]>;
    getGameInfo(gameId?: string): Promise<types.IGameInfo>;
    getModInfo(modId: number, gameId?: string): Promise<types.IModInfo>;
    getModFiles(modId: number, gameId?: string): Promise<types.IModFiles>;
    getFileInfo(modId: number, fileId: number, gameId?: string): Promise<types.IFileInfo>;
    getDownloadURLs(modId: number, fileId: number, gameId?: string): Promise<types.IDownloadURL[]>;
    sendFeedback(message: string, fileBundle: string, anonymous: boolean, groupingKey?: string, id?: string): Promise<void>;
    private filter(obj);
    private args(customArgs);
}
export default Nexus;
