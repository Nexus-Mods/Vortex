import * as types from './types';

import * as Promise from 'bluebird';
import * as fs from 'fs';
import request = require('request');
import format = require('string-template');

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

export class NexusError extends Error {
  private mStatusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.mStatusCode = statusCode;
  }

  public get statusCode() {
    return this.mStatusCode;
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class HTTPError extends Error {
  constructor(statusCode: number, message: string) {
    super(`HTTP (${statusCode}) - ${message}`);
    this.name = this.constructor.name;
  }
}

function handleRestResult(resolve, reject, url: string, error: any,
                          response: request.RequestResponse, body: any) {
  if (error !== null) {
    if ((error.code === 'ETIMEDOUT') || (error.code === 'ESOCKETTIMEOUT')) {
      return reject(new TimeoutError('request timed out: ' + url));
    }
    return reject(error);
  }

  try {
    const data = JSON.parse(body);

    if ((response.statusCode < 200) || (response.statusCode >= 300)) {
      reject(new NexusError(data.message || data.error, response.statusCode));
    }

    resolve(data);
  } catch (err) {
    reject(new Error('failed to parse server response'));
  }
}

function restGet(url: string, args: IRequestArgs): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    request.get(format(url, args.path || {}), {
      headers: args.headers,
      followRedirect: true,
      timeout: args.requestConfig.timeout,
    }, (error, response, body) => {
      handleRestResult(resolve, reject, url, error, response, body);
    });
  });
}

function restPost(url: string, args: IRequestArgs): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    request.post({
      url: format(url, args.path),
      headers: args.headers,
      followRedirect: true,
      timeout: args.requestConfig.timeout,
      form: args.data,
    }, (error, response, body) => {
      handleRestResult(resolve, reject, url, error, response, body);
    });
  });
}

function rest(url: string, args: IRequestArgs): Promise<any> {
  return args.data !== undefined
    ? restPost(url, args)
    : restGet(url, args);
}

/**
 * implements the Nexus API
 *
 * @class Nexus
 */
class Nexus {
  private mBaseData: IRequestArgs;

  private mBaseURL = 'https://api.nexusmods.com/v1';

  constructor(game: string, apiKey: string, timeout?: number) {
    this.mBaseData = {
      headers: {
        'Content-Type': 'application/json',
        APIKEY: apiKey,
      },
      path: {
        gameId: game,
      },
      requestConfig: {
        timeout: timeout || 5000,
        noDelay: true,
      },
      responseConfig: {
        timeout: timeout || 5000,
      },
    };
  }

  public setGame(gameId: string): void {
    this.mBaseData.path.gameId = gameId;
  }

  public setKey(apiKey: string): void {
    this.mBaseData.headers.APIKEY = apiKey;
  }

  public validateKey(key?: string): Promise<types.IValidateKeyResponse> {
    return rest(this.mBaseURL + '/users/validate',
                this.args({ headers: this.filter({ APIKEY: key }) }));
  }

  public endorseMod(modId: number, modVersion: string,
                    endorseStatus: string, gameId?: string): Promise<any> {
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/{endorseStatus}', this.args({
      path: this.filter({ gameId, modId, endorseStatus }),
      data: this.filter({ Version: modVersion }),
    }));
  }

  public getGames(): Promise<types.IGameListEntry[]> {
    return rest(this.mBaseURL + '/games', this.args({}));
  }

  public getGameInfo(gameId?: string): Promise<types.IGameInfo> {
    return rest(this.mBaseURL + '/games/{gameId}', this.args({
      path: this.filter({ gameId }),
    }));
  }

  public getModInfo(modId: number, gameId?: string): Promise<types.IModInfo> {
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}', this.args({
      path: this.filter({ modId, gameId }),
    }));
  }

  public getModFiles(modId: number, gameId?: string): Promise<types.IModFiles> {
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files', this.args({
      path: this.filter({ modId, gameId }),
    }));
  }

  public getFileInfo(modId: number,
                     fileId: number,
                     gameId?: string): Promise<types.IFileInfo> {
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}', this.args({
      path: this.filter({ modId, fileId, gameId }),
    }));
  }

  public getDownloadURLs(modId: number,
                         fileId: number,
                         gameId?: string): Promise<types.IDownloadURL[]> {
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}/download_link',
                this.args({ path: this.filter({ modId, fileId, gameId }) }));
  }

  public sendFeedback(message: string,
                      fileBundle: string,
                      anonymous: boolean,
                      groupingKey?: string,
                      id?: string) {
    return new Promise<void>((resolve, reject) => {
      const formData = {
        feedback_text: message,
      };
      if (fileBundle !== undefined) {
        formData['feedback_file'] = fs.createReadStream(fileBundle);
      }
      if (groupingKey !== undefined) {
        formData['grouping_key'] = groupingKey;
      }
      if (id !== undefined) {
        formData['reference'] = id;
      }
      const headers = {};

      if (!anonymous) {
        headers['APIKEY'] = this.mBaseData.headers['APIKEY'];
      }

      const url = anonymous
        ? 'https://api.nexusmods.com/v1/feedbacks/anonymous'
        : 'https://api.nexusmods.com/v1/feedbacks';

      request.post({
        headers,
        url,
        formData,
        timeout: 30000,
      }, (error, response, body) => {
        if (error !== null) {
          return reject(error);
        } else if (response.statusCode >= 400) {
          return reject(new HTTPError(response.statusCode, response.statusMessage));
        } else {
          return resolve();
        }
      });
    });
  }

  private filter(obj: any): any {
    const result = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  private handleResult(data, response, resolve, reject) {
    if ((response.statusCode >= 200) && (response.statusCode < 300)) {
      try {
        resolve(data);
      } catch (err) {
        reject(new Error('failed to parse server response: ' + err.message));
      }
    } else {
      reject(new NexusError(data.message, response.statusCode));
    }
  }

  private args(customArgs: IRequestArgs) {
    const result: IRequestArgs = { ...this.mBaseData };
    for (const key of Object.keys(customArgs)) {
      result[key] = {
        ...result[key],
        ...customArgs[key],
      };
    }
    return result;
  }
}

export default Nexus;
