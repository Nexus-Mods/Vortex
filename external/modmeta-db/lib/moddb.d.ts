import * as Promise from 'bluebird';
import { ILookupResult, IModInfo } from './types';
export interface IServer {
    protocol: 'nexus' | 'metadb';
    url: string;
    apiKey?: string;
    cacheDurationSec: number;
}
declare class ModDB {
    private mDB;
    private mServers;
    private mModKeys;
    private mRestClient;
    private mTimeout;
    private mGameId;
    constructor(gameId: string, servers: IServer[], database?: any, timeoutMS?: number);
    setGameId(gameId: string): void;
    getByKey(key: string): Promise<ILookupResult[]>;
    insert(mod: IModInfo): Promise<void>;
    lookup(filePath: string, gameId?: string, modId?: string): Promise<ILookupResult[]>;
    private restBaseData(server);
    private nexusBaseData(server);
    private queryServer(server, gameId, hash);
    private queryServerNexus(server, gameId, hash);
    private queryServerMeta(server, gameId, hash);
    private translateNexusGameId(input);
    private translateFromNexus;
    private getAllByKey(key, gameId);
    private makeKey(mod);
    private missingKeys(mod);
    private promisify();
}
export default ModDB;
