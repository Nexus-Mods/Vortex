import * as Promise from 'bluebird';
import leveljs = require('level-js');
import levelup = require('levelup');
import { Client } from 'node-rest-client';
import * as semvish from 'semvish';

import {IHashResult, ILookupResult, IModInfo} from './types';
import { genHash } from './util';

import * as util from 'util';

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

export interface IServer {
  protocol: 'nexus' | 'metadb';
  url: string;
  apiKey?: string;
  cacheDurationSec: number;
}

/**
 * The primary database interface.
 * This allows queries about meta information regarding a file and
 * will relay them to a remote server if not found locally
 */
class ModDB {
  private mDB: IDatabase;
  private mServers: IServer[];
  private mModKeys: string[];
  private mRestClient: Client;
  private mTimeout: number;
  private mGameId: string;

  /**
   * constructor
   * 
   * @param {string} gameId default game id for lookups
   * @param {string} servers list of servers we synchronize with
   * @param {any} database the database backend to use. if not set, tries to use IndexedDB
   * @param {number} timeoutMS timeout in milliseconds for outgoing network requests.
   *                           defaults to 5 seconds
   */
  constructor(gameId: string, servers: IServer[], database?: any, timeoutMS?: number) {
    this.mDB =
        levelup('mods', {valueEncoding: 'json', db: database || leveljs});
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
    this.mServers = servers;
    this.mTimeout = timeoutMS;

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
    return this.getAllByKey(key, this.mGameId);
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
   * @param {string} fileMD5
   * @param {number} fileSize
   * @param {string} [gameId]
   * @param {string} [modId]
   * @returns {Promise<ILookupResult[]>}
   * 
   * @memberOf ModDB
   */
  public lookup(filePath?: string, fileMD5?: string, fileSize?: number,
                gameId?: string, modId?: string): Promise<ILookupResult[]> {
    let hashResult: string = fileMD5;
    let hashFileSize: number = fileSize;

    if ((filePath === undefined) && (fileMD5 === undefined)) {
      return Promise.resolve([]);
    }

    let promise = fileMD5 !== undefined
      ? Promise.resolve()
      : genHash(filePath).then((res: IHashResult) => {
        hashResult = res.md5sum;
        hashFileSize = res.numBytes;
        return Promise.resolve();
      });

    return promise.then(() => {
      let lookupKey = `${hashResult}:${hashFileSize}`;
      if (gameId !== undefined) {
        lookupKey += ':' + gameId;
        if (modId !== undefined) {
          lookupKey += ':' + modId;
        }
      }
      return this.getAllByKey(lookupKey, gameId);
    });
  }

  private restBaseData(server: IServer): IRequestArgs {
    return {
      headers: {
        'Content-Type': 'application/json',
      },
      path: {
      },
      requestConfig: {
        timeout: this.mTimeout || 5000,
        noDelay: true,
      },
      responseConfig: {
        timeout: this.mTimeout || 5000,
      },
    };
  }

  private nexusBaseData(server: IServer): IRequestArgs {
    let res = this.restBaseData(server);
    res.headers.APIKEY = server.apiKey;
    return res;
  }

  private queryServer(server: IServer, gameId: string, hash: string): Promise<ILookupResult[]> {
    if (server.protocol === 'nexus') {
      return this.queryServerNexus(server, gameId, hash);
    } else {
      return this.queryServerMeta(server, gameId, hash);
    }
  }

  private queryServerNexus(server: IServer, gameId: string,
                           hash: string): Promise<ILookupResult[]> {
    // no result in our database, look at the backends
    const realGameId = this.translateNexusGameId(gameId || this.mGameId);

    const url = `${server.url}/games/${realGameId}/mods/md5_search/${hash}`;
    return new Promise<ILookupResult[]>((resolve, reject) => {
      try {
        this.mRestClient.get(
            url, this.nexusBaseData(server), (data, response) => {
              if (response.statusCode === 200) {
                let result: ILookupResult[] =
                    data.map((nexusObj: any) =>
                                 this.translateFromNexus(nexusObj, gameId));
                // and return to caller
                resolve(result);
              } else {
                reject(new Error(util.inspect(data)));
              }
            });
      } catch (err) {
        reject(err);
      }
    });
  }

  private queryServerMeta(server: IServer, gameId: string, hash: string): Promise<ILookupResult[]> {
    const url = `${server.url}/by_hash/${hash}`;
    return new Promise<ILookupResult[]>((resolve, reject) => {
      this.mRestClient.get(url, this.restBaseData(server), (data, response) => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(util.inspect(data)));
        }
      });
    });
  }

  private translateNexusGameId(input: string): string {
    if (input === 'skyrimse') {
      return 'skyrimspecialedition';
    } else {
      return input;
    }
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
      nexusObj.file_details.file_id,
    ];

    const page =
      `http://www.nexusmods.com/${nexusObj.mod.game_domain}/mods/${nexusObj.mod.mod_id}/`;
    return {
      key:
          `${nexusObj.file_details.md5}:${nexusObj.file_details.size}:${gameId}:`,
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
        details: {
          category: nexusObj.mod.category,
          description: nexusObj.mod.description,
          author: nexusObj.mod.author,
          homepage: page,
        },
      },
    };
  };

  private getAllByKey(key: string, gameId: string): Promise<ILookupResult[]> {
    return new Promise<ILookupResult[]>((resolve, reject) => {
             let result: ILookupResult[] = [];

             let stream = this.mDB.createReadStream({
               gte: key + ':',
               lt: key + 'a:',
             });
             stream.on('data', (data: ILookupResult) => { result.push(data); });
             stream.on('error', (err) => { reject(err); });
             stream.on('end', () => { resolve(result); });
           })
        .then((results: ILookupResult[]) => {
          if (results.length > 0) {
            return Promise.resolve(results);
          }

          let hash = key.split(':')[0];
          let remoteResults: ILookupResult[];

          return Promise.mapSeries(
                            this.mServers,
                            (server: IServer) => {
                              if (remoteResults) {
                                return Promise.resolve();
                              }
                              return this.queryServer(server, gameId, hash)
                                  .then((serverResults: ILookupResult[]) => {
                                    remoteResults = serverResults;
                                    // cache all results in our database
                                    for (let result of remoteResults) {
                                      let temp =
                                          Object.assign({}, result.value);
                                      temp.expires =
                                          new Date().getTime() / 1000 +
                                          server.cacheDurationSec;
                                      this.insert(result.value);
                                    }
                                  });
                            })
              .then(() => { return Promise.resolve(remoteResults); });
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
