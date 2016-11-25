import * as Promise from 'bluebird';
import { ILookupResult, IModInfo } from './types';
declare class ModDB {
    private mDB;
    private mModKeys;
    private mRestClient;
    private mBaseData;
    private mGameId;
    private mBaseURL;
    constructor(location: string, gameId: string, apiKey: string, timeout?: number);
    setGameId(gameId: string): void;
    getByKey(key: string): Promise<ILookupResult[]>;
    insert(mod: IModInfo): Promise<void>;
    lookup(filePath: string, gameId?: string, modId?: string): Promise<ILookupResult[]>;
    private translateNexusGameId(input);
    private translateFromNexus;
    private getAllByKey(key);
    private makeKey(mod);
    private missingKeys(mod);
    private promisify();
}
export default ModDB;
