"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const fs = require("fs");
const request = require("request");
const format = require("string-template");
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
    constructor(statusCode, message, body) {
        super(`HTTP (${statusCode}) - ${message}`);
        this.name = this.constructor.name;
        this.mBody = body;
    }
    get body() {
        return this.mBody;
    }
}
exports.HTTPError = HTTPError;
function handleRestResult(resolve, reject, url, error, response, body) {
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
    }
    catch (err) {
        reject(new Error('failed to parse server response'));
    }
}
function restGet(url, args) {
    return new Promise((resolve, reject) => {
        request.get(format(url, args.path || {}), {
            headers: args.headers,
            followRedirect: true,
            timeout: args.requestConfig.timeout,
        }, (error, response, body) => {
            handleRestResult(resolve, reject, url, error, response, body);
        });
    });
}
function restPost(url, args) {
    return new Promise((resolve, reject) => {
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
function rest(url, args) {
    return args.data !== undefined
        ? restPost(url, args)
        : restGet(url, args);
}
class Nexus {
    constructor(game, apiKey, timeout) {
        this.mBaseURL = 'https://api.nexusmods.com/v1';
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
    setGame(gameId) {
        this.mBaseData.path.gameId = gameId;
    }
    setKey(apiKey) {
        this.mBaseData.headers.APIKEY = apiKey;
    }
    validateKey(key) {
        return rest(this.mBaseURL + '/users/validate', this.args({ headers: this.filter({ APIKEY: key }) }));
    }
    endorseMod(modId, modVersion, endorseStatus, gameId) {
        return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/{endorseStatus}', this.args({
            path: this.filter({ gameId, modId, endorseStatus }),
            data: this.filter({ Version: modVersion }),
        }));
    }
    getGames() {
        return rest(this.mBaseURL + '/games', this.args({}));
    }
    getGameInfo(gameId) {
        return rest(this.mBaseURL + '/games/{gameId}', this.args({
            path: this.filter({ gameId }),
        }));
    }
    getModInfo(modId, gameId) {
        return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}', this.args({
            path: this.filter({ modId, gameId }),
        }));
    }
    getModFiles(modId, gameId) {
        return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files', this.args({
            path: this.filter({ modId, gameId }),
        }));
    }
    getFileInfo(modId, fileId, gameId) {
        return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}', this.args({
            path: this.filter({ modId, fileId, gameId }),
        }));
    }
    getDownloadURLs(modId, fileId, gameId) {
        return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}/download_link', this.args({ path: this.filter({ modId, fileId, gameId }) }));
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
                    return reject(new HTTPError(response.statusCode, response.statusMessage, body));
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
}
exports.default = Nexus;
//# sourceMappingURL=Nexus.js.map