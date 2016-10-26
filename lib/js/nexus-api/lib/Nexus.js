"use strict";
const Promise = require('bluebird');
const node_rest_client_1 = require('node-rest-client');
class Nexus {
    constructor(appId) {
        this.mBaseURL = 'https://api.nexusmods.com/v1';
        this.mLegacyURL = 'http://nmm.nexusmods.com/games/';
        this.mAppId = appId;
        this.mRestClient = new node_rest_client_1.Client();
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
    validateKey(apiKey) {
        this.mApiKey = apiKey;
        return new Promise((resolve, reject) => {
            this.mRestClient.methods.validateKey(this.args({ data: { apiKey } }), (data, response) => this.handleResult(data, response, resolve, reject));
        });
    }
    getModInfo(modId) {
        return new Promise((resolve, reject) => {
            this.mRestClient.methods.getModInfo(this.args({ path: { modId } }), (data, response) => this.handleResult(data, response, resolve, reject));
        });
    }
    getDownloadURLs(fileId) {
        return new Promise((resolve, reject) => {
            this.mRestClient.methods.getDownloadURLs(this.args({ path: { fileId } }), (data, response) => this.handleResult(data, response, resolve, reject));
        });
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
            reject({ statusCode: response.statusCode, message: data.message });
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
        this.mRestClient.registerMethod('validateKey', this.mBaseURL + '/users/validate.json', 'GET');
        this.mRestClient.registerMethod('getModInfo', this.mLegacyURL + 'Mods/${modId}&game_id=${gameId}', 'GET');
        this.mRestClient.registerMethod('getDownloadURLs', this.mLegacyURL + 'Files/download/${fileId}&game_id=${gameId}', 'GET');
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Nexus;
//# sourceMappingURL=Nexus.js.map