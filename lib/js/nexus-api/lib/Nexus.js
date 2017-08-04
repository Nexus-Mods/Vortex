"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const fs = require("fs");
const request = require("request");
class NexusError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.mStatusCode = statusCode;
    }
    get statusCode() {
        return this.mStatusCode;
    }
}
exports.NexusError = NexusError;
class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.TimeoutError = TimeoutError;
class HTTPError extends Error {
    constructor(statusCode, message) {
        super(`HTTP (${statusCode}) - ${message}`);
        this.name = this.constructor.name;
    }
}
exports.HTTPError = HTTPError;
class Nexus {
    constructor(game, apiKey, timeout) {
        this.mBaseURL = 'https://api.nexusmods.com/v1';
        const { Client } = require('node-rest-client');
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
            const req = this.mRestClient.methods.validateKey(this.args({ headers: this.filter({ APIKEY: key }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject(new TimeoutError('validating key')));
            req.on('responesTimeout', () => reject(new TimeoutError('validateing key')));
            req.on('error', (err) => reject(err));
        });
    }
    endorseMod(modId, modVersion, endorseStatus, gameId) {
        return new Promise((resolve, reject) => {
            this.mRestClient.methods.endorseMod(this.args({
                path: this.filter({ gameId, modId, endorseStatus }),
                data: this.filter({ Version: modVersion }),
            }), (data, response) => this.handleResult(data, response, resolve, reject));
        });
    }
    getGames() {
        return new Promise((resolve, reject) => {
            const req = this.mRestClient.methods.getGames(this.args({}), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('responesTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('error', (err) => reject(err));
        });
    }
    getGameInfo(gameId) {
        return new Promise((resolve, reject) => {
            const req = this.mRestClient.methods.getGameInfo(this.args({ path: this.filter({ gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('responesTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('error', (err) => reject(err));
        });
    }
    getModInfo(modId, gameId) {
        return new Promise((resolve, reject) => {
            const req = this.mRestClient.methods.getModInfo(this.args({ path: this.filter({ modId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('responesTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('error', (err) => reject(err));
        });
    }
    getModFiles(modId, gameId) {
        return new Promise((resolve, reject) => {
            const req = this.mRestClient.methods.getModFiles(this.args({ path: this.filter({ modId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', r => {
                r.abort();
                reject(new TimeoutError('contacting api ' + modId));
            });
            req.on('responesTimeout', res => reject(new TimeoutError('contacting api')));
            req.on('error', (err) => reject(err));
        });
    }
    getFileInfo(modId, fileId, gameId) {
        return new Promise((resolve, reject) => {
            const req = this.mRestClient.methods.getFileInfo(this.args({ path: this.filter({ modId, fileId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('responesTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('error', (err) => reject(err));
        });
    }
    getDownloadURLs(modId, fileId, gameId) {
        return new Promise((resolve, reject) => {
            const req = this.mRestClient.methods.getDownloadURLs(this.args({ path: this.filter({ modId, fileId, gameId }) }), (data, response) => this.handleResult(data, response, resolve, reject));
            req.on('requestTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('responesTimeout', () => reject(new TimeoutError('contacting api')));
            req.on('error', (err) => reject(err));
        });
    }
    sendFeedback(message, fileBundle, anonymous, groupingKey, id) {
        return new Promise((resolve, reject) => {
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
                }
                else if (response.statusCode >= 400) {
                    return reject(new HTTPError(response.statusCode, response.statusMessage));
                }
                else {
                    return resolve();
                }
            });
        });
    }
    filter(obj) {
        const result = {};
        Object.keys(obj).forEach((key) => {
            if (obj[key] !== undefined) {
                result[key] = obj[key];
            }
        });
        return result;
    }
    handleResult(data, response, resolve, reject) {
        if ((response.statusCode >= 200) && (response.statusCode < 300)) {
            try {
                resolve(data);
            }
            catch (err) {
                reject(new Error('failed to parse server response: ' + err.message));
            }
        }
        else {
            reject(new NexusError(data.message, response.statusCode));
        }
    }
    args(customArgs) {
        const result = Object.assign({}, this.mBaseData);
        for (const key of Object.keys(customArgs)) {
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