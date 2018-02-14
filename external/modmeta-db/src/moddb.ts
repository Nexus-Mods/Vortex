import * as Promise from 'bluebird';
import levelup = require('levelup');
import * as minimatch from 'minimatch';
import * as restT from 'node-rest-client';
import * as semvish from 'semvish';

import {IHashResult, IIndexResult, ILookupResult, IModInfo} from './types';
import {genHash} from './util';

import * as util from 'util';

interface ILevelUpAsync extends LevelUp {
  getAsync?: (key: string) => Promise<any>;
  putAsync?: (key: string, data: any) => Promise<void>;
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

interface IBlacklistEntry {
  key?: string;
  logicalName?: string;
  expression?: string;
  versionMatch?: string;
  gameId?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFunc = (level: LogLevel, message: string, extra?: any) => void;

/**
 * The primary database interface.
 * This allows queries about meta information regarding a file and
 * will relay them to a remote server if not found locally
 */
class ModDB {
  private mDB: ILevelUpAsync;
  private mServers: IServer[];
  private mModKeys: string[];
  private mRestClient: restT.Client;
  private mTimeout: number;
  private mGameId: string;
  private mBlacklist: Set<string> = new Set();
  private mLog: LogFunc;

  /**
   * constructor
   *
   * @param {string} dbName name for the new databaes
   * @param {string} gameId default game id for lookups to the nexus api
   * @param {IServer} servers list of servers we synchronize with
   * @param {LogFunc} log function called for logging messages
   * @param {any} database the database backend to use. if not set, tries to use leveldb
   * @param {number} timeoutMS timeout in milliseconds for outgoing network requests.
   *                           defaults to 5 seconds
   */
  constructor(dbName: string,
              gameId: string,
              servers: IServer[],
              log?: LogFunc,
              database?: any,
              timeoutMS?: number) {
    this.mDB = levelup(dbName, {valueEncoding: 'json', db: database});
    this.mModKeys = [
      'fileName',
      'fileVersion',
      'fileMD5',
      'fileSizeBytes',
      'sourceURI',
      'gameId',
    ];

    this.mGameId = gameId;
    const { Client } = require('node-rest-client') as typeof restT;
    this.mRestClient = new Client();
    this.mServers = servers;
    this.mTimeout = timeoutMS;
    this.mLog = log || (() => undefined);

    this.promisify();
  }

  /**
   * close meta database
   */
  public close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mDB.close((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  /**
   * update the gameId which is used as the default for lookups to the nexus
   * api if the game id of the file being looked up isn't available
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
   * retrieve mods by their logical name and version
   */
  public getByLogicalName(logicalName: string, versionMatch: string): Promise<ILookupResult[]> {
    return this.getAllByLogicalName(logicalName, versionMatch);
  }

  public getByExpression(expression: string, versionMatch: string): Promise<ILookupResult[]> {
    return this.getAllByExpression(expression, versionMatch);
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
    const missingKeys = this.missingKeys(mod);
    if (missingKeys.length !== 0) {
      return Promise.reject(new Error('Invalid mod object. Missing keys: ' +
                                      missingKeys.join(', ')));
    }

    const key = this.makeKey(mod);

    return this.mDB.putAsync(key, mod)
      .then(() => this.mDB.putAsync(this.makeNameLookup(mod), key))
      .then(() => this.mDB.putAsync(this.makeLogicalLookup(mod), key))
    ;
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
   * @returns {Promise<ILookupResult[]>}
   *
   * @memberOf ModDB
   */
  public lookup(filePath?: string, fileMD5?: string, fileSize?: number,
                gameId?: string): Promise<ILookupResult[]> {
    let hashResult: string = fileMD5;
    let hashFileSize: number = fileSize;

    if ((filePath === undefined) && (fileMD5 === undefined)) {
      return Promise.resolve([]);
    }

    const promise = fileMD5 !== undefined
      ? Promise.resolve()
      : genHash(filePath).then((res: IHashResult) => {
        hashResult = res.md5sum;
        hashFileSize = res.numBytes;
        return Promise.resolve();
      });

    return promise.then(() => {
      let lookupKey = `${hashResult}`;
      if (hashFileSize !== undefined) {
        lookupKey += ':' + hashFileSize;
        if (gameId !== undefined) {
          lookupKey += ':' + gameId;
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
    const res = this.restBaseData(server);
    res.headers.APIKEY = server.apiKey;
    return res;
  }

  private queryServerLogical(server: IServer, logicalName: string,
                             versionMatch: string): Promise<ILookupResult[]> {
    if (server.protocol === 'nexus') {
      // not supported
      return Promise.resolve([]);
    }

    const url = `${server.url}/by_name/${logicalName}/versionMatch`;
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

  private queryServerHash(server: IServer, gameId: string, hash: string): Promise<ILookupResult[]> {
    if (server.protocol === 'nexus') {
      return this.queryServerHashNexus(server, gameId, hash);
    } else {
      return this.queryServerHashMeta(server, hash);
    }
  }

  private queryServerHashNexus(server: IServer, gameId: string,
                               hash: string): Promise<ILookupResult[]> {
    // no result in our database, look at the backends
    const realGameId = this.translateNexusGameId(gameId || this.mGameId);

    const url = `${server.url}/games/${realGameId}/mods/md5_search/${hash}`;
    return new Promise<ILookupResult[]>((resolve, reject) => {
      try {
        const request = this.mRestClient.get(
            url, this.nexusBaseData(server), (data, response) => {
              if (response.statusCode === 200) {
                const result: ILookupResult[] =
                    data.map((nexusObj: any) =>
                                 this.translateFromNexus(nexusObj, gameId));
                // and return to caller
                resolve(result);
              } else if (response.statusCode === 521) {
                reject(new Error('API offline'));
                // data contains an html page from cloudflare -> useless
              } else {
                // TODO not sure what data contains at this point. If the api is working
                // correct it _should_ be a json object containing an error message
                reject(new Error(util.inspect(data)));
              }
            });
        request.on('requestTimeout', () => reject(new Error('request timeout')));
        request.on('responseTimeout', () => reject(new Error('response timeout')));
        request.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private queryServerHashMeta(server: IServer, hash: string): Promise<ILookupResult[]> {
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
    } else if (input === 'falloutnv') {
      return 'newvegas';
    } else {
      return input;
    }
  }

  /**
   * the nexus site currently uses a different api
   *
   * @private
   *
   * @memberOf ModDB
   */
  private translateFromNexus = (nexusObj: any, gameId: string):
      ILookupResult => {
        const urlFragments = [
          'nxm:/',
          nexusObj.mod.game_domain,
          'mods',
          nexusObj.mod.mod_id,
          'files',
          nexusObj.file_details.file_id,
        ];

        const page =
            `https://www.nexusmods.com/${nexusObj.mod.game_domain}/mods/${nexusObj.mod.mod_id}/`;
        return {
          key:
              `hash:${nexusObj.file_details.md5}:${nexusObj.file_details.size}:${gameId}:`,
          value: {
            fileMD5: nexusObj.file_details.md5,
            fileName: nexusObj.file_details.file_name,
            fileSizeBytes: nexusObj.file_details.file_size,
            logicalFileName: nexusObj.file_details.name,
            fileVersion: semvish.clean(nexusObj.file_details.version, true),
            gameId,
            sourceURI: urlFragments.join('/'),
            details: {
              category: nexusObj.mod.category_id,
              description: nexusObj.mod.description,
              author: nexusObj.mod.author,
              homepage: page,
            },
          },
        };
  }

  private readRange<T>(type: 'hash' | 'log' | 'name', key: string,
                       terminate: boolean = true): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      const result: T[] = [];

      let stream;

      if (terminate) {
        stream = this.mDB.createReadStream({
          gte: type + ':' + key + ':',
          lt: type + ':' + key + 'a:',
        });
      } else {
        stream = this.mDB.createReadStream({
          gte: type + ':' + key,
          lte: type + ':' + key + 'zzzzzzzzzzzzzzzzzzz:',
        });
      }

      stream.on('data', (data: T) => result.push(data));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(result));
    });
  }

  private getAllByKey(key: string, gameId: string): Promise<ILookupResult[]> {
    if (this.mBlacklist.has(JSON.stringify({ key, gameId }))) {
      // avoid querying the same keys again and again
      return Promise.resolve([]);
    }

    return this.readRange<ILookupResult>('hash', key)
        .then((results: ILookupResult[]) => {
          if (results.length > 0) {
            return Promise.resolve(results);
          }

          const hash = key.split(':')[0];
          let remoteResults: ILookupResult[];

          return Promise.mapSeries(this.mServers, (server: IServer) => {
                          if (remoteResults) {
                            return Promise.resolve();
                          }
                          return this.queryServerHash(server, gameId, hash)
                              .then((serverResults: ILookupResult[]) => {
                                remoteResults = serverResults;
                                // cache all results in our database
                                for (const result of remoteResults) {
                                  const temp = { ...result.value };
                                  temp.expires = new Date().getTime() / 1000 +
                                                 server.cacheDurationSec;
                                  this.insert(result.value);
                                }
                              })
                              .catch(err => {
                                this.mLog('warn', 'failed to query by key', {
                                  server: server.url, key, gameId, error: err.message.toString(),
                                });
                                this.mBlacklist.add(JSON.stringify({ key, gameId }));
                              });
                        }).then(() => Promise.resolve(remoteResults || []));
        });
  }

  private resolveIndex(key: string): Promise<ILookupResult> {
    return new Promise<ILookupResult>(
        (resolve, reject) => this.mDB.get(key, (err, value) => {
          if (err) {
            reject(err);
          } else {
            resolve(value);
          }
        }));
  }

  private getAllByLogicalName(logicalName: string, versionMatch: string): Promise<ILookupResult[]> {
    if (this.mBlacklist.has(JSON.stringify({ logicalName, versionMatch }))) {
      return Promise.resolve([]);
    }
    const versionFilter = res =>
        semvish.satisfies(res.key.split(':')[2], versionMatch, false);
    return this.readRange<IIndexResult>('log', logicalName)
        .then((results: IIndexResult[]) =>
                  Promise.map(results.filter(versionFilter),
                              (indexResult: IIndexResult) =>
                                  this.resolveIndex(indexResult.value)))
        .then((results: ILookupResult[]) => {
          if (results.length > 0) {
            return Promise.resolve(results);
          }

          let remoteResults: ILookupResult[];

          return Promise.mapSeries(this.mServers, (server: IServer) => {
                          if (remoteResults) {
                            return Promise.resolve();
                          }
                          return this.queryServerLogical(server, logicalName,
                                                         versionMatch)
                              .then((serverResults: ILookupResult[]) => {
                                remoteResults = serverResults;
                                // cache all results in our database
                                for (const result of remoteResults) {
                                  const temp = { ...result.value };
                                  temp.expires = new Date().getTime() / 1000 +
                                                 server.cacheDurationSec;
                                  this.insert(result.value);
                                }
                              })
                              .catch(err => {
                                this.mLog('warn', 'failed to query by logical name', {
                                  server: server.url, logicalName, versionMatch,
                                  error: err.message.toString(),
                                });
                                this.mBlacklist.add(JSON.stringify({ logicalName, versionMatch }));
                              });
                        }).then(() => Promise.resolve(remoteResults || []));
        });
  }

  private getAllByExpression(expression: string, versionMatch: string): Promise<ILookupResult[]> {
    if (this.mBlacklist.has(JSON.stringify({ expression, versionMatch }))) {
      return Promise.resolve([]);
    }
    const filter = res => {
      const [type, fileName, version] = res.key.split(':');
      return minimatch(fileName, expression)
        && semvish.satisfies(version, versionMatch, false);
    };

    const staticPart = expression.split(/[?*]/)[0];

    return this.readRange<IIndexResult>('name', staticPart, false)
        .then((results: IIndexResult[]) =>
                  Promise.map(results.filter(filter),
                              (indexResult: IIndexResult) =>
                                  this.resolveIndex(indexResult.value)))
        .then((results: ILookupResult[]) => {
          if (results.length > 0) {
            return Promise.resolve(results);
          }

          let remoteResults: ILookupResult[];

          return Promise.mapSeries(this.mServers, (server: IServer) => {
                          if (remoteResults) {
                            return Promise.resolve();
                          }
                          return this.queryServerLogical(server, expression,
                                                         versionMatch)
                              .then((serverResults: ILookupResult[]) => {
                                remoteResults = serverResults;
                                // cache all results in our database
                                for (const result of remoteResults) {
                                  const temp = { ...result.value };
                                  temp.expires = new Date().getTime() / 1000 +
                                                 server.cacheDurationSec;
                                  this.insert(result.value);
                                }
                              })
                              .catch(err => {
                                this.mLog('warn', 'failed to query by expression', {
                                  server: server.url, expression, versionMatch,
                                  error: err.message.toString(),
                                });
                                this.mBlacklist.add(JSON.stringify({ expression, versionMatch }));
                              });
                        }).then(() => Promise.resolve(remoteResults || []));
        });
  }

  private makeKey(mod: IModInfo) {
    return `hash:${mod.fileMD5}:${mod.fileSizeBytes}:${mod.gameId}:`;
  }

  private makeNameLookup(mod: IModInfo) {
    return `name:${mod.fileName}:${mod.fileVersion}:`;
  }

  private makeLogicalLookup(mod: IModInfo) {
    return `log:${mod.logicalFileName}:${mod.fileVersion}:`;
  }

  private missingKeys(mod: any) {
    const actualKeys = new Set(Object.keys(mod));
    return this.mModKeys.filter(key => !actualKeys.has(key));
  }

  private promisify() {
    this.mDB.getAsync = Promise.promisify(this.mDB.get);
    this.mDB.putAsync = Promise.promisify(this.mDB.put) as any;
  }
}

export default ModDB;
