"use strict";
const Promise = require('bluebird');
const leveljs = require('level-js');
const levelup = require('levelup');
const node_rest_client_1 = require('node-rest-client');
const semvish = require('semvish');
const util_1 = require('./util');
const util = require('util');
class ModDB {
    constructor(gameId, servers, database, timeoutMS) {
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
            levelup('mods', { valueEncoding: 'json', db: database || leveljs });
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
        this.mServers = servers;
        this.mTimeout = timeoutMS;
        this.promisify();
    }
    setGameId(gameId) {
        this.mGameId = gameId;
    }
    getByKey(key) {
        return this.getAllByKey(key, this.mGameId);
    }
    insert(mod) {
        let missingKeys = this.missingKeys(mod);
        if (missingKeys.length !== 0) {
            return Promise.reject(new Error('Invalid mod object. Missing keys: ' +
                missingKeys.join(', ')));
        }
        return this.mDB.putAsync(this.makeKey(mod), mod);
    }
    lookup(filePath, fileMD5, fileSize, gameId, modId) {
        let hashResult = fileMD5;
        let hashFileSize = fileSize;
        let promise = fileMD5 !== undefined
            ? Promise.resolve()
            : util_1.genHash(filePath).then((res) => {
                hashResult = res.md5sum;
                hashFileSize = res.numBytes;
                return Promise.resolve();
            });
        return promise.then(() => {
            let lookupKey = `${hashResult}:${hashFileSize}`;
            if (gameId !== undefined) {
                lookupKey += ':' + gameId;
                if (modId !== undefined) {
                    lookupKey += ':' + modId;
                }
            }
            return this.getAllByKey(lookupKey, gameId);
        });
    }
    restBaseData(server) {
        return {
            headers: {
                'Content-Type': 'application/json',
            },
            path: {},
            requestConfig: {
                timeout: this.mTimeout || 5000,
                noDelay: true,
            },
            responseConfig: {
                timeout: this.mTimeout || 5000,
            },
        };
    }
    nexusBaseData(server) {
        let res = this.restBaseData(server);
        res.headers.APIKEY = server.apiKey;
        return res;
    }
    queryServer(server, gameId, hash) {
        if (server.protocol === 'nexus') {
            return this.queryServerNexus(server, gameId, hash);
        }
        else {
            return this.queryServerMeta(server, gameId, hash);
        }
    }
    queryServerNexus(server, gameId, hash) {
        const realGameId = this.translateNexusGameId(gameId || this.mGameId);
        const url = `${server.url}/games/${realGameId}/mods/md5_search/${hash}`;
        return new Promise((resolve, reject) => {
            try {
                this.mRestClient.get(url, this.nexusBaseData(server), (data, response) => {
                    if (response.statusCode === 200) {
                        let result = data.map((nexusObj) => this.translateFromNexus(nexusObj, gameId));
                        resolve(result);
                    }
                    else {
                        reject(new Error(util.inspect(data)));
                    }
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    queryServerMeta(server, gameId, hash) {
        const url = `${server.url}/by_hash/${hash}`;
        return new Promise((resolve, reject) => {
            this.mRestClient.get(url, this.restBaseData(server), (data, response) => {
                if (response.statusCode === 200) {
                    resolve(data);
                }
                else {
                    reject(new Error(util.inspect(data)));
                }
            });
        });
    }
    translateNexusGameId(input) {
        if (input === 'skyrimse') {
            return 'skyrimspecialedition';
        }
        else {
            return input;
        }
    }
    getAllByKey(key, gameId) {
        return new Promise((resolve, reject) => {
            let result = [];
            let stream = this.mDB.createReadStream({
                gte: key + ':',
                lt: key + 'a:',
            });
            stream.on('data', (data) => { result.push(data); });
            stream.on('error', (err) => { reject(err); });
            stream.on('end', () => { resolve(result); });
        })
            .then((results) => {
            if (results.length > 0) {
                return Promise.resolve(results);
            }
            let hash = key.split(':')[0];
            let remoteResults;
            return Promise.mapSeries(this.mServers, (server) => {
                if (remoteResults) {
                    return Promise.resolve();
                }
                return this.queryServer(server, gameId, hash)
                    .then((serverResults) => {
                    remoteResults = serverResults;
                    for (let result of remoteResults) {
                        let temp = Object.assign({}, result.value);
                        temp.expires =
                            new Date().getTime() / 1000 +
                                server.cacheDurationSec;
                        this.insert(result.value);
                    }
                });
            })
                .then(() => { return Promise.resolve(remoteResults); });
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
