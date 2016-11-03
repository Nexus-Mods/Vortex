import * as types from './types';

import * as Promise from 'bluebird';
import { Client } from 'node-rest-client';

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

/**
 * implements the Nexus API
 * 
 * @class Nexus
 */
class Nexus {
  private mRestClient: Client;
  private mBaseData: IRequestArgs;

  private mBaseURL = 'https://api.nexusmods.com/v1';

  constructor(game: string, apiKey: string) {
    this.mRestClient = new Client();
    this.mBaseData = {
      headers: {
        'Content-Type': 'application/json',
        APIKEY: apiKey,
      },
      path: {
        gameId: game,
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

  public setGame(gameId: string): void {
    this.mBaseData.path.gameId = gameId;
  }

  public setKey(apiKey: string): void {
    this.mBaseData.headers.APIKEY = apiKey;
  }

  public validateKey(key?: string): Promise<types.IValidateKeyResponse> {
    return new Promise<types.IValidateKeyResponse>((resolve, reject) => {
      this.mRestClient.methods.validateKey(
        this.args({ headers: this.filter({ APIKEY: key }) }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getGames(): Promise<types.IGameListEntry[]> {
    return new Promise<types.IGameListEntry[]>((resolve, reject) => {
      this.mRestClient.methods.getGames(this.args({}),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getGameInfo(gameId?: string): Promise<types.IGameInfo> {
    return new Promise<types.IGameInfo>((resolve, reject) => {
      this.mRestClient.methods.getGameInfo(
        this.args({ path: this.filter({ gameId }) }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getModInfo(modId: number, gameId?: string): Promise<types.IModInfo> {
    return new Promise<types.IModInfo>((resolve, reject) => {
      this.mRestClient.methods.getModInfo(
        this.args({ path: this.filter({ modId, gameId }) }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getModFiles(modId: number, gameId?: string): Promise<types.IFileInfo[]> {
    return new Promise<any>((resolve, reject) => {
      this.mRestClient.methods.getModFiles(
        this.args({ path: this.filter({ modId, gameId }) }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getFileInfo(modId: number,
                     fileId: number,
                     gameId?: string): Promise<types.IFileInfo> {
    return new Promise<types.IFileInfo>((resolve, reject) => {
      this.mRestClient.methods.getFileInfo(
        this.args({ path: this.filter({ modId, fileId, gameId }) }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  public getDownloadURLs(modId: number,
                         fileId: number,
                         gameId?: string): Promise<types.IDownloadURL[]> {
    return new Promise<types.IDownloadURL[]>((resolve, reject) => {
      this.mRestClient.methods.getDownloadURLs(
        this.args({ path: this.filter({ modId, fileId, gameId }) }),
        (data, response) => this.handleResult(data, response, resolve, reject));
    });
  }

  private filter(obj: Object): Object {
    let result = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    });
    return result;
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
    let result: IRequestArgs = Object.assign({}, this.mBaseData);
    for (let key of Object.keys(customArgs)) {
      result[key] = Object.assign({}, result[key], customArgs[key]);
    }
    return result;
  }

  private initMethods() {
    this.mRestClient.registerMethod(
      'validateKey', this.mBaseURL + '/users/validate', 'GET');

    this.mRestClient.registerMethod(
      'getGames', this.mBaseURL + '/games', 'GET');

    this.mRestClient.registerMethod(
      'getGameInfo', this.mBaseURL + '/games/${gameId}', 'GET');

    this.mRestClient.registerMethod(
      'getModInfo', this.mBaseURL + '/games/${gameId}/mods/${modId}', 'GET');

    this.mRestClient.registerMethod(
      'getModFiles', this.mBaseURL + '/games/${gameId}/mods/${modId}/files', 'GET');

    this.mRestClient.registerMethod(
      'getFileInfo', this.mBaseURL + '/games/${gameId}/mods/${modId}/files/${fileId}', 'GET');

    this.mRestClient.registerMethod(
      'getDownloadURLs',
      this.mBaseURL + '/games/${gameId}/mods/${modId}/files/${fileId}/download_link', 'GET');
  }
}

export default Nexus;
