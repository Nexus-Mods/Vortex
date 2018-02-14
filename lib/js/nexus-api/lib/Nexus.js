"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const param = require("./parameters");
const fs = require("fs");
const request = require("request");
const format = require("string-template");
class NexusError extends Error {
    constructor(message, statusCode, url) {
        super(message);
        this.mStatusCode = statusCode;
        this.mRequest = url;
    }
    get statusCode() {
        return this.mStatusCode;
    }
    get request() {
        return this.mRequest;
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
        if (response.statusCode === 521) {
            return reject(new NexusError('API currently offline', response.statusCode, url));
        }
        const data = JSON.parse(body || '{}');
        if ((response.statusCode < 200) || (response.statusCode >= 300)) {
            return reject(new NexusError(data.message || data.error || response.statusMessage, response.statusCode, url));
        }
        resolve(data);
    }
    catch (err) {
        reject(new Error('failed to parse server response: ' + err.message));
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
            body: JSON.stringify(args.data),
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
class Quota {
    constructor(init, max, msPerIncrement) {
        this.mLastCheck = Date.now();
        this.mCount = init;
        this.mMaximum = max;
        this.mMSPerIncrement = msPerIncrement;
    }
    wait() {
        return new Promise((resolve, reject) => {
            const now = Date.now();
            const recovered = Math.floor((now - this.mLastCheck) / this.mMSPerIncrement);
            this.mCount = Math.min(this.mCount + recovered, this.mMaximum);
            this.mLastCheck = now;
            --this.mCount;
            if (this.mCount >= 0) {
                return resolve();
            }
            else {
                setTimeout(resolve, this.mCount * this.mMSPerIncrement * -1);
            }
        });
    }
    setMax(newMax) {
        this.mMaximum = newMax;
    }
}
class Nexus {
    constructor(game, apiKey, timeout) {
        this.mBaseURL = param.API_URL;
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
    setGame(gameId) {
        this.mBaseData.path.gameId = gameId;
    }
    setKey(apiKey) {
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
        }
        else {
            this.mQuota.setMax(param.QUOTA_MAX);
        }
    }
    validateKey(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/users/validate', this.args({ headers: this.filter({ APIKEY: key }) }));
        });
    }
    endorseMod(modId, modVersion, endorseStatus, gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/{endorseStatus}', this.args({
                path: this.filter({ gameId, modId, endorseStatus }),
                data: this.filter({ Version: modVersion }),
            }));
        });
    }
    getGames() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games', this.args({}));
        });
    }
    getGameInfo(gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games/{gameId}', this.args({
                path: this.filter({ gameId }),
            }));
        });
    }
    getModInfo(modId, gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}', this.args({
                path: this.filter({ modId, gameId }),
            }));
        });
    }
    getModFiles(modId, gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files', this.args({
                path: this.filter({ modId, gameId }),
            }));
        });
    }
    getFileInfo(modId, fileId, gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}', this.args({
                path: this.filter({ modId, fileId, gameId }),
            }));
        });
    }
    getDownloadURLs(modId, fileId, gameId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
            return rest(this.mBaseURL + '/games/{gameId}/mods/{modId}/files/{fileId}/download_link', this.args({ path: this.filter({ modId, fileId, gameId }) }));
        });
    }
    sendFeedback(message, fileBundle, anonymous, groupingKey, id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.mQuota.wait();
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
                    }
                    else if (response.statusCode >= 400) {
                        return reject(new HTTPError(response.statusCode, response.statusMessage, body));
                    }
                    else {
                        return resolve();
                    }
                });
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