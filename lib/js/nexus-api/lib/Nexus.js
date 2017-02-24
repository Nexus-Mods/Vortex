"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const node_rest_client_1 = require("node-rest-client");
class NexusError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.mStatusCode = statusCode;
    }
    get statusCode() {
        return this.mStatusCode;
    }
}
class Nexus {
    constructor(game, apiKey, timeout) {
        this.mBaseURL = 'https://api.nexusmods.com/v1';
        this.mRestClient = new node_rest_client_1.Client();
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
        this.initMethods();
    }
    setGame(gameId) {
        this.mBaseData.path.gameId = gameId;
    }
    setKey(apiKey) {
        this.mBaseData.headers.APIKEY = apiKey;
    }
    validateKey(key) {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.validateKey(this.args({ headers: this.filter({ APIKEY: key }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    endorseMod(version, modId, endorseStatus, gameId) {
        return new Promise((resolve, reject) => {
            this.mRestClient.methods.endorseMod(this.args({ path: this.filter({ modId, gameId, endorseStatus }),
                data: this.filter({ Version: version }) }), (data, response) => this.handleResult(data, response, resolve, reject));
        });
    }
    getGames() {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.getGames(this.args({}), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    getGameInfo(gameId) {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.getGameInfo(this.args({ path: this.filter({ gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    getModInfo(modId, gameId) {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.getModInfo(this.args({ path: this.filter({ modId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    getModFiles(modId, gameId) {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.getModFiles(this.args({ path: this.filter({ modId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    getFileInfo(modId, fileId, gameId) {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.getFileInfo(this.args({ path: this.filter({ modId, fileId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    getDownloadURLs(modId, fileId, gameId) {
        return new Promise((resolve, reject) => {
            let req = this.mRestClient.methods.getDownloadURLs(this.args({ path: this.filter({ modId, fileId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject('validate key timeout'));
            req.on('responesTimeout', () => reject('validate key timeout'));
            req.on('error', (err) => reject(err));
        });
    }
    filter(obj) {
        let result = {};
        Object.keys(obj).forEach((key) => {
            if (obj[key] !== undefined) {
                result[key] = obj[key];
            }
        });
        return result;
    }
    handleResult(data, response, resolve, reject) {
        if (response.statusCode === 200) {
            try {
                resolve(data);
            }
            catch (err) {
                reject({ message: 'failed to parse server response: ' + err.message });
            }
        }
        else {
            reject(new NexusError(data.message, response.statusCode));
        }
    }
    args(customArgs) {
        let result = Object.assign({}, this.mBaseData);
        for (let key of Object.keys(customArgs)) {
            result[key] = Object.assign({}, result[key], customArgs[key]);
        }
        return result;
    }
    initMethods() {
        this.mRestClient.registerMethod('validateKey', this.mBaseURL + '/users/validate', 'GET');
        this.mRestClient.registerMethod('getGames', this.mBaseURL + '/games', 'GET');
        this.mRestClient.registerMethod('getGameInfo', this.mBaseURL + '/games/${gameId}', 'GET');
        this.mRestClient.registerMethod('getModInfo', this.mBaseURL + '/games/${gameId}/mods/${modId}', 'GET');
        this.mRestClient.registerMethod('getModFiles', this.mBaseURL + '/games/${gameId}/mods/${modId}/files', 'GET');
        this.mRestClient.registerMethod('getFileInfo', this.mBaseURL + '/games/${gameId}/mods/${modId}/files/${fileId}', 'GET');
        this.mRestClient.registerMethod('endorseMod', this.mBaseURL + '/games/${gameId}/mods/${modId}/${endorseStatus}', 'POST');
        this.mRestClient.registerMethod('getDownloadURLs', this.mBaseURL + '/games/${gameId}/mods/${modId}/files/${fileId}/download_link', 'GET');
    }
}
exports.default = Nexus;
//# sourceMappingURL=Nexus.js.map