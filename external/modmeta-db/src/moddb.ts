import * as Promise from 'bluebird';
import * as path from 'path';
import levelup = require('levelup');

import {IHashResult, ILookupResult, IModInfo} from './types';
import { genHash } from './util';

interface IDatabase extends LevelUp {
  getAsync?: Function;
  putAsync?: Function;
}

class ModDB {
  private mDB: IDatabase;
  private mModKeys: string[];

  constructor(location: string) {
    this.mDB =
        levelup(path.join(location, 'mods.ldb'), {valueEncoding: 'json'});
    this.mModKeys = [
      'modId',
      'modName',
      'fileName',
      'fileVersion',
      'fileMD5',
      'fileSizeBytes',
      'sourceURI',
      'gameId',
    ];
    this.promisify();
  }

  /**
   * retrieve a mod if the hash (or a full key) is already known
   * 
   * @param {string} hash
   * @returns {Promise<ILookupResult[]>}
   * 
   * @memberOf ModDB
   */
  public getByKey(key: string): Promise<ILookupResult[]> {
    return this.getAllByKey(key);
  }

  /**
   * insert a mod into the database, potentially overwriting
   * existing data
   * 
   * @param {IModInfo} mod
   * @returns {Promise<void>}
   * 
   * @memberOf ModDB
   */
  public insert(mod: IModInfo): Promise<void> {
    let missingKeys = this.missingKeys(mod);
    if (missingKeys.length !== 0) {
      return Promise.reject({
        message: 'Invalid mod object',
        missing_keys: missingKeys,
      });
    }
    return this.mDB.putAsync(this.makeKey(mod), mod);
  }

  /**
   * look up the meta information for the mod identified by the
   * parameters.
   * Please note that this may return multiple results, i.e. if
   * the same file has been uploaded for multiple games and gameId
   * is left undefined 
   * 
   * @param {string} filePath
   * @param {string} [gameId]
   * @param {string} [modId]
   * @returns {Promise<ILookupResult[]>}
   * 
   * @memberOf ModDB
   */
  public lookup(filePath: string, gameId?: string,
                modId?: string): Promise<ILookupResult[]> {
    return genHash(filePath).then((res: IHashResult) => {
      let lookupKey = `${res.md5sum}:${res.numBytes}`;
      if (gameId !== undefined) {
        lookupKey += ':' + gameId;
        if (modId !== undefined) {
          lookupKey += ':' + modId;
        }
      }
      console.log('looking up mod', lookupKey);
      return this.getAllByKey(lookupKey);
    });
  }

  private getAllByKey(key: string): Promise<ILookupResult[]> {
    return new Promise<ILookupResult[]>((resolve, reject) => {
      let result: ILookupResult[] = [];

      let stream = this.mDB.createReadStream({
        gte: key + ':',
        lt: key + 'a:',
      });
      stream.on('data', (data: ILookupResult) => {
        console.log('got data', data);
        result.push(data);
      });
      stream.on('error', (err) => {
        console.log('error looking up key', key);
        reject(err);
      });
      stream.on('end', () => {
        console.log('done');
        resolve(result);
      });
    });
  }

  private makeKey(mod: IModInfo) {
    return `${mod.fileMD5}:${mod.fileSizeBytes}:${mod.gameId}:${mod.modId}:`;
  }

  private missingKeys(mod: any) {
    let actualKeys = new Set(Object.keys(mod));
    return this.mModKeys.filter((key) => !actualKeys.has(key));
  }

  private promisify() {
    this.mDB.getAsync = Promise.promisify(this.mDB.get);
    this.mDB.putAsync = Promise.promisify(this.mDB.put);
  }
}

export default ModDB;
