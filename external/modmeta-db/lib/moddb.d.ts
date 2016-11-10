import * as Promise from 'bluebird';
import { ILookupResult, IModInfo } from './types';
declare class ModDB {
    private mDB;
    private mModKeys;
    constructor(location: string);
    getByKey(key: string): Promise<ILookupResult[]>;
    insert(mod: IModInfo): Promise<void>;
    lookup(filePath: string, gameId?: string, modId?: string): Promise<ILookupResult[]>;
    private getAllByKey(key);
    private makeKey(mod);
    private missingKeys(mod);
    private promisify();
}
export default ModDB;
