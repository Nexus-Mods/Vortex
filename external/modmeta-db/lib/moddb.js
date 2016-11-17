"use strict";
const Promise = require('bluebird');
const leveljs = require('level-js');
const levelup = require('levelup');
const node_rest_client_1 = require('node-rest-client');
const semvish = require('semvish');
const util_1 = require('./util');
class ModDB {
    constructor(location, gameId, apiKey, timeout) {
        this.mBaseURL = 'https://api.nexusmods.com/v1';
        this.translateFromNexus = (nexusObj, gameId) => {
            let urlFragments = [
                'nxm:/',
                nexusObj.mod.game_domain,
                'mods',
                nexusObj.mod.mod_id,
                'files',
                nexusObj.file_details.file_id
            ];
            return {
                key: `${nexusObj.file_details.md5}:${nexusObj.file_details.size}:${gameId}:`,
                value: {
                    fileMD5: nexusObj.file_details.md5,
                    fileName: nexusObj.file_details.file_name,
                    fileSizeBytes: nexusObj.file_details.file_size,
                    logicalFileName: nexusObj.file_details.name,
                    fileVersion: semvish.clean(nexusObj.file_details.version),
                    gameId: nexusObj.mod.game_domain,
                    modName: nexusObj.mod.name,
                    modId: nexusObj.mod.mod_id,
                    sourceURI: urlFragments.join('/'),
                },
            };
        };
        this.mDB =
            levelup('mods', { valueEncoding: 'json', db: leveljs });
        this.mModKeys = [
            'modId',
            'modName',
            'fileName',
            'fileVersion',
            'fileMD5',
            'fileSizeBytes',
            'sourceURI',
            'gameId',
        ];
        this.mGameId = gameId;
        this.mRestClient = new node_rest_client_1.Client();
        this.mBaseData = {
            headers: {
                'Content-Type': 'application/json',
                APIKEY: apiKey,
            },
            path: {},
            requestConfig: {
                timeout: timeout || 5000,
                noDelay: true,
            },
            responseConfig: {
                timeout: timeout || 5000,
            },
        };
        this.promisify();
    }
    setGameId(gameId) {
        this.mGameId = gameId;
    }
    getByKey(key) {
        return this.getAllByKey(key);
    }
    insert(mod) {
        let missingKeys = this.missingKeys(mod);
        if (missingKeys.length !== 0) {
            return Promise.reject(new Error('Invalid mod object. Missing keys: ' +
                missingKeys.join(', ')));
        }
        return this.mDB.putAsync(this.makeKey(mod), mod);
    }
    lookup(filePath, gameId, modId) {
        let hashResult;
        return util_1.genHash(filePath)
            .then((res) => {
            hashResult = res.md5sum;
            let lookupKey = `${res.md5sum}:${res.numBytes}`;
            if (gameId !== undefined) {
                lookupKey += ':' + gameId;
                if (modId !== undefined) {
                    lookupKey += ':' + modId;
                }
            }
            return this.getAllByKey(lookupKey);
        })
            .then((results) => {
            if (results.length > 0) {
                return results;
            }
            const realGameId = gameId || this.mGameId;
            const url = `${this.mBaseURL}/games/${realGameId}/mods/md5_search/${hashResult}`;
            return new Promise((resolve, reject) => {
                this.mRestClient.get(url, this.mBaseData, (data, response) => {
                    if (response.statusCode === 200) {
                        let altResults = data.map((nexusObj) => this.translateFromNexus(nexusObj, gameId));
                        for (let result of altResults) {
                            this.insert(result.value);
                        }
                        resolve(altResults);
                    }
                    else {
                        reject(new Error(data));
                    }
                });
            });
        });
    }
    getAllByKey(key) {
        return new Promise((resolve, reject) => {
            let result = [];
            let stream = this.mDB.createReadStream({
                gte: key + ':',
                lt: key + 'a:',
            });
            stream.on('data', (data) => {
                result.push(data);
            });
            stream.on('error', (err) => {
                reject(err);
            });
            stream.on('end', () => {
                resolve(result);
            });
        });
    }
    makeKey(mod) {
        return `${mod.fileMD5}:${mod.fileSizeBytes}:${mod.gameId}:${mod.modId}:`;
    }
    missingKeys(mod) {
        let actualKeys = new Set(Object.keys(mod));
        return this.mModKeys.filter((key) => !actualKeys.has(key));
    }
    promisify() {
        this.mDB.getAsync = Promise.promisify(this.mDB.get);
        this.mDB.putAsync = Promise.promisify(this.mDB.put);
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ModDB;
