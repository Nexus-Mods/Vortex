import * as types from './types';

import * as Promise from 'bluebird';
import { Client } from 'node-rest-client';

interface IRequestArgs {
  headers?: Object;
  path?: Object;
  data?: Object;
  requestConfig?: {
    timeout: number,
    noDelay: boolean,
  };
  responseConfig?: {
    timeout: number,
  };
}

/**
 * implements the Nexus API
 * 
 * @class Nexus
 */
class Nexus {

  private mApiKey: string;
  private mAppId: string;
  private mRestClient: Client;
  private mBaseData: IRequestArgs;

  private mBaseURL = 'https://api.nexusmods.com/v1';
  private mLegacyURL = 'http://nmm.nexusmods.com/games/';

  constructor(appId: string) {
    this.mAppId = appId;
    this.mRestClient = new Client();
    this.mBaseData = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Nexus Client v0.63.1',
      },
      path: {
        gameId: 110,
      },
      requestConfig: {
        timeout: 1000,
        noDelay: true,
      },
      responseConfig: {
        timeout: 1000,
      },
    };

    this.initMethods();
  }

  public validateKey(apiKey: string): Promise<types.IValidateKeyResponse> {
    this.mApiKey = apiKey;
    return new Promise<types.IValidateKeyResponse>((resolve, reject) => {
      this.mRestClient.methods.validateKey(this.args({ data: { apiKey } }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getModInfo(modId: number): Promise<types.IGetModInfoResponse> {
    return new Promise<types.IGetModInfoResponse>((resolve, reject) => {
      this.mRestClient.methods.getModInfo(this.args({ path: { modId } }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getDownloadURLs(fileId: number): Promise<types.IDownloadURL[]> {
    return new Promise<types.IDownloadURL[]>((resolve, reject) => {
      this.mRestClient.methods.getDownloadURLs(this.args({ path: { fileId } }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  private handleResult(data, response, resolve, reject) {
    if (response.statusCode === 200) {
      try {
        resolve(data);
      } catch (err) {
        reject({ message: 'failed to parse server response: ' + err.message });
      }
    } else {
      reject({ statusCode: response.statusCode, message: data.message });
    }
  }

  private args(customArgs: IRequestArgs) {
    let result = Object.assign({}, this.mBaseData);
    for (let key of Object.keys(customArgs)) {
      result[key] = Object.assign({}, result[key], customArgs[key]);
    }
    return result;
  }

  private initMethods() {
    this.mRestClient.registerMethod(
      'validateKey', this.mBaseURL + '/users/validate.json', 'GET');

    this.mRestClient.registerMethod(
      'getModInfo', this.mLegacyURL + 'Mods/${modId}&game_id=${gameId}', 'GET');

    this.mRestClient.registerMethod(
      'getDownloadURLs', this.mLegacyURL + 'Files/download/${fileId}&game_id=${gameId}', 'GET');
  }
}

export default Nexus;
