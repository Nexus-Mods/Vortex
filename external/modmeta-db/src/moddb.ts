import * as Promise from 'bluebird';
import leveljs = require('level-js');
import levelup = require('levelup');
import { Client } from 'node-rest-client';
import * as path from 'path';
import * as semvish from 'semvish';

import {IHashResult, ILookupResult, IModInfo} from './types';
import { genHash } from './util';

interface IDatabase extends LevelUp {
  getAsync?: Function;
  putAsync?: Function;
}

interface IRequestArgs {
  headers?: any;
  path?: any;
  data?: any;
  requestConfig?: {
    timeout: number,
    noDelay: boolean,
  };
  responseConfig?: {
    timeout: number,
  };
}

class ModDB {
  private mDB: IDatabase;
  private mModKeys: string[];
  private mRestClient: Client;
  private mBaseData: IRequestArgs;
  private mGameId: string;
  private mBaseURL: string = 'https://api.nexusmods.com/v1';

  constructor(location: string, gameId: string, apiKey: string, timeout?: number) {
    this.mDB =
        levelup('mods', {valueEncoding: 'json', db: leveljs});
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

    this.mGameId = gameId;
    this.mRestClient = new Client();

    this.mBaseData = {
      headers: {
        'Content-Type': 'application/json',
        APIKEY: apiKey,
      },
      path: {
      },
      requestConfig: {
        timeout: timeout || 5000,
        noDelay: true,
      },
      responseConfig: {
        timeout: timeout || 5000,
      },
    };

    this.promisify();
  }

  /**
   * update the gameId (of the game currently being managed)
   * which is used as the default for lookups if the game id of the file being looked up
   * isn't available
   * 
   * @param {string} gameId
   * 
   * @memberOf ModDB
   */
  public setGameId(gameId: string) {
    this.mGameId = gameId;
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
      return Promise.reject(new Error('Invalid mod object. Missing keys: ' +
                                      missingKeys.join(', ')));
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
    let hashResult: string;
    return genHash(filePath)
        .then((res: IHashResult) => {
          hashResult = res.md5sum;
          let lookupKey = `${res.md5sum}:${res.numBytes}`;
          if (gameId !== undefined) {
            lookupKey += ':' + gameId;
            if (modId !== undefined) {
              lookupKey += ':' + modId;
            }
          }
          return this.getAllByKey(lookupKey);
        })
        .then((results: ILookupResult[]) => {
          if (results.length > 0) {
            return results;
          }

          // no result in our database, look at the backends
          const realGameId = gameId || this.mGameId;
          const url =
              `${this.mBaseURL}/games/${realGameId}/mods/md5_search/${hashResult}`;
          return new Promise<ILookupResult[]>((resolve, reject) => {
            this.mRestClient.get(url, this.mBaseData, (data, response) => {
              if (response.statusCode === 200) {
                let altResults: ILookupResult[] =
                    data.map((nexusObj: any) =>
                                 this.translateFromNexus(nexusObj, gameId));
                // cache all results in our database
                for (let result of altResults) {
                  this.insert(result.value);
                }
                // and return to caller
                resolve(altResults);
              } else {
                reject(new Error(data));
              }
            });
          });
        });
  }

  /**
   * the nexus api currently uses a different api
   * 
   * @private
   * 
   * @memberOf ModDB
   */
  private translateFromNexus = (nexusObj: any, gameId: string): ILookupResult => {
    let urlFragments = [
      'nxm:/',
      nexusObj.mod.game_domain,
      'mods',
      nexusObj.mod.mod_id,
      'files',
      nexusObj.file_details.file_id
    ];
    return {
      key: `${nexusObj.file_details.md5}:${nexusObj.file_details.size}:${gameId}:`,
      value: {
        fileMD5: nexusObj.file_details.md5,
        fileName: nexusObj.file_details.file_name,
        fileSizeBytes: nexusObj.file_details.file_size,
        logicalFileName: nexusObj.file_details.name,
        fileVersion: semvish.clean(nexusObj.file_details.version),
        gameId: nexusObj.mod.game_domain,
        modName: nexusObj.mod.name,
        modId: nexusObj.mod.mod_id,
        sourceURI: urlFragments.join('/'),
      },
    };
  }

  private getAllByKey(key: string): Promise<ILookupResult[]> {
    return new Promise<ILookupResult[]>((resolve, reject) => {
      let result: ILookupResult[] = [];

      let stream = this.mDB.createReadStream({
        gte: key + ':',
        lt: key + 'a:',
      });
      stream.on('data', (data: ILookupResult) => {
        result.push(data);
      });
      stream.on('error', (err) => {
        reject(err);
      });
      stream.on('end', () => {
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
