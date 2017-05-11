/// <reference types="bluebird" />
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
    constructor(dbName: string, gameId: string, servers: IServer[], database?: any, timeoutMS?: number);
    setGameId(gameId: string): void;
    getByKey(key: string): Promise<ILookupResult[]>;
    getByLogicalName(logicalName: string, versionMatch: string): Promise<ILookupResult[]>;
    getByExpression(expression: string, versionMatch: string): Promise<ILookupResult[]>;
    insert(mod: IModInfo): Promise<void>;
    lookup(filePath?: string, fileMD5?: string, fileSize?: number, gameId?: string): Promise<ILookupResult[]>;
    private restBaseData(server);
    private nexusBaseData(server);
    private queryServerLogical(server, logicalName, versionMatch);
    private queryServerHash(server, gameId, hash);
    private queryServerHashNexus(server, gameId, hash);
    private queryServerHashMeta(server, hash);
    private translateNexusGameId(input);
    private translateFromNexus;
    private readRange<T>(type, key, terminate?);
    private getAllByKey(key, gameId);
    private resolveIndex(key);
    private getAllByLogicalName(logicalName, versionMatch);
    private getAllByExpression(expression, versionMatch);
    private makeKey(mod);
    private makeNameLookup(mod);
    private makeLogicalLookup(mod);
    private missingKeys(mod);
    private promisify();
}
export default ModDB;
