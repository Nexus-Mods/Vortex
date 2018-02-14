import * as param from './parameters';
import * as types from './types';

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
  private mRequest: string;
  constructor(message: string, statusCode: number, url: string) {
    super(message);
    this.mStatusCode = statusCode;
    this.mRequest = url;
  }

  public get statusCode() {
    return this.mStatusCode;
  }

  public get request() {
    return this.mRequest;
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class HTTPError extends Error {
  private mBody: string;
  constructor(statusCode: number, message: string, body: string) {
    super(`HTTP (${statusCode}) - ${message}`);
    this.name = this.constructor.name;
    this.mBody = body;
  }
  public get body(): string {
    return this.mBody;
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
    if (response.statusCode === 521) {
      // in this case the body isn't something the api sent so it probably can't be parsed
      return reject(new NexusError('API currently offline', response.statusCode, url));
    }

    const data = JSON.parse(body || '{}');

    if ((response.statusCode < 200) || (response.statusCode >= 300)) {
      return reject(new NexusError(data.message || data.error || response.statusMessage,
                                   response.statusCode, url));
    }

    resolve(data);
  } catch (err) {
    reject(new Error('failed to parse server response: ' + err.message));
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
      body: JSON.stringify(args.data),
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

class Quota {
  private mCount: number;
  private mMaximum: number;
  private mMSPerIncrement: number;
  private mLastCheck: number = Date.now();

  constructor(init: number, max: number, msPerIncrement: number) {
    this.mCount = init;
    this.mMaximum = max;
    this.mMSPerIncrement = msPerIncrement;
  }

  public wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const recovered = Math.floor((now - this.mLastCheck) / this.mMSPerIncrement);
      this.mCount = Math.min(this.mCount + recovered, this.mMaximum);
      this.mLastCheck = now;
      --this.mCount;
      if (this.mCount >= 0) {
        return resolve();
      } else {
        setTimeout(resolve, this.mCount * this.mMSPerIncrement * -1);
      }
    });
  }

  public setMax(newMax: number) {
    this.mMaximum = newMax;
  }
}

/**
 * implements the Nexus API
 *
 * @class Nexus
 */
class Nexus {
  private mBaseData: IRequestArgs;

  private mBaseURL = param.API_URL;
  private mQuota;

  constructor(game: string, apiKey: string, timeout?: number) {
    this.mBaseData = {
      headers: {
        'Content-Type': 'application/json',
        APIKEY: undefined,
      },
      path: {
        gameId: game,
      },
      requestConfig: {
        timeout: timeout || param.DEFAULT_TIMEOUT_MS,
        noDelay: true,
      },
      responseConfig: {
        timeout: timeout || param.DEFAULT_TIMEOUT_MS,
      },
    };

    this.mQuota = new Quota(param.QUOTA_MAX, param.QUOTA_MAX, param.QUOTA_RATE_MS);
    this.setKey(apiKey);
  }

  public setGame(gameId: string): void {
    this.mBaseData.path.gameId = gameId;
  }

  public setKey(apiKey: string): void {
    this.mBaseData.headers.APIKEY = apiKey;
    if (apiKey !== undefined) {
      this.validateKey(apiKey)
        .then(res => {
          if (this.mBaseData.headers.APIKEY === apiKey) {
            this.mQuota.setMax(res['is_premium?'] ? param.QUOTA_MAX_PREMIUM : param.QUOTA_MAX);
          }
        })
        .catch(err => {
          this.mQuota.setMax(param.QUOTA_MAX);
        });
    } else {
      this.mQuota.setMax(param.QUOTA_MAX);
    }
  }

  public async validateKey(key?: string): Promise<types.IValidateKeyResponse> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/users/validate',
                this.args({ headers: this.filter({ APIKEY: key }) }));
  }

  public async endorseMod(modId: number, modVersion: string,
                          endorseStatus: string, gameId?: string): Promise<any> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/{endorseStatus}', this.args({
      path: this.filter({ gameId, modId, endorseStatus }),
      data: this.filter({ Version: modVersion }),
    }));
  }

  public async getGames(): Promise<types.IGameListEntry[]> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games', this.args({}));
  }

  public async getGameInfo(gameId?: string): Promise<types.IGameInfo> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games/{gameId}', this.args({
      path: this.filter({ gameId }),
    }));
  }

  public async getModInfo(modId: number, gameId?: string): Promise<types.IModInfo> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}', this.args({
      path: this.filter({ modId, gameId }),
    }));
  }

  public async getModFiles(modId: number, gameId?: string): Promise<types.IModFiles> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files', this.args({
      path: this.filter({ modId, gameId }),
    }));
  }

  public async getFileInfo(modId: number,
                           fileId: number,
                           gameId?: string): Promise<types.IFileInfo> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}', this.args({
      path: this.filter({ modId, fileId, gameId }),
    }));
  }

  public async getDownloadURLs(modId: number,
                               fileId: number,
                               gameId?: string): Promise<types.IDownloadURL[]> {
    await this.mQuota.wait();
    return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}/download_link',
                this.args({ path: this.filter({ modId, fileId, gameId }) }));
  }

  public async sendFeedback(message: string,
                            fileBundle: string,
                            anonymous: boolean,
                            groupingKey?: string,
                            id?: string) {
    await this.mQuota.wait();
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
        ? `${param.API_URL}/feedbacks/anonymous`
        : `${param.API_URL}/feedbacks`;

      request.post({
        headers,
        url,
        formData,
        timeout: 30000,
      }, (error, response, body) => {
        if (error !== null) {
          return reject(error);
        } else if (response.statusCode >= 400) {
          return reject(new HTTPError(response.statusCode, response.statusMessage, body));
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
