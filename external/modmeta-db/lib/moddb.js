"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const levelup = require("levelup");
const minimatch = require("minimatch");
const semvish = require("semvish");
const util_1 = require("./util");
const util = require("util");
class ModDB {
    constructor(dbName, gameId, servers, log, database, timeoutMS) {
        this.mBlacklist = new Set();
        this.translateFromNexus = (nexusObj, gameId) => {
            const urlFragments = [
                'nxm:/',
                nexusObj.mod.game_domain,
                'mods',
                nexusObj.mod.mod_id,
                'files',
                nexusObj.file_details.file_id,
            ];
            const page = `https://www.nexusmods.com/${nexusObj.mod.game_domain}/mods/${nexusObj.mod.mod_id}/`;
            return {
                key: `hash:${nexusObj.file_details.md5}:${nexusObj.file_details.size}:${gameId}:`,
                value: {
                    fileMD5: nexusObj.file_details.md5,
                    fileName: nexusObj.file_details.file_name,
                    fileSizeBytes: nexusObj.file_details.file_size,
                    logicalFileName: nexusObj.file_details.name,
                    fileVersion: semvish.clean(nexusObj.file_details.version, true),
                    gameId,
                    sourceURI: urlFragments.join('/'),
                    details: {
                        category: nexusObj.mod.category_id,
                        description: nexusObj.mod.description,
                        author: nexusObj.mod.author,
                        homepage: page,
                    },
                },
            };
        };
        this.mDB = levelup(dbName, { valueEncoding: 'json', db: database });
        this.mModKeys = [
            'fileName',
            'fileVersion',
            'fileMD5',
            'fileSizeBytes',
            'sourceURI',
            'gameId',
        ];
        this.mGameId = gameId;
        const { Client } = require('node-rest-client');
        this.mRestClient = new Client();
        this.mServers = servers;
        this.mTimeout = timeoutMS;
        this.mLog = log || (() => undefined);
        this.promisify();
    }
    close() {
        return new Promise((resolve, reject) => {
            this.mDB.close((err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    setGameId(gameId) {
        this.mGameId = gameId;
    }
    getByKey(key) {
        return this.getAllByKey(key, this.mGameId);
    }
    getByLogicalName(logicalName, versionMatch) {
        return this.getAllByLogicalName(logicalName, versionMatch);
    }
    getByExpression(expression, versionMatch) {
        return this.getAllByExpression(expression, versionMatch);
    }
    insert(mod) {
        const missingKeys = this.missingKeys(mod);
        if (missingKeys.length !== 0) {
            return Promise.reject(new Error('Invalid mod object. Missing keys: ' +
                missingKeys.join(', ')));
        }
        const key = this.makeKey(mod);
        return this.mDB.putAsync(key, mod)
            .then(() => this.mDB.putAsync(this.makeNameLookup(mod), key))
            .then(() => this.mDB.putAsync(this.makeLogicalLookup(mod), key));
    }
    lookup(filePath, fileMD5, fileSize, gameId) {
        let hashResult = fileMD5;
        let hashFileSize = fileSize;
        if ((filePath === undefined) && (fileMD5 === undefined)) {
            return Promise.resolve([]);
        }
        const promise = fileMD5 !== undefined
            ? Promise.resolve()
            : util_1.genHash(filePath).then((res) => {
                hashResult = res.md5sum;
                hashFileSize = res.numBytes;
                return Promise.resolve();
            });
        return promise.then(() => {
            let lookupKey = `${hashResult}`;
            if (hashFileSize !== undefined) {
                lookupKey += ':' + hashFileSize;
                if (gameId !== undefined) {
                    lookupKey += ':' + gameId;
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
        const res = this.restBaseData(server);
        res.headers.APIKEY = server.apiKey;
        return res;
    }
    queryServerLogical(server, logicalName, versionMatch) {
        if (server.protocol === 'nexus') {
            return Promise.resolve([]);
        }
        const url = `${server.url}/by_name/${logicalName}/versionMatch`;
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
    queryServerHash(server, gameId, hash) {
        if (server.protocol === 'nexus') {
            return this.queryServerHashNexus(server, gameId, hash);
        }
        else {
            return this.queryServerHashMeta(server, hash);
        }
    }
    queryServerHashNexus(server, gameId, hash) {
        const realGameId = this.translateNexusGameId(gameId || this.mGameId);
        const url = `${server.url}/games/${realGameId}/mods/md5_search/${hash}`;
        return new Promise((resolve, reject) => {
            try {
                const request = this.mRestClient.get(url, this.nexusBaseData(server), (data, response) => {
                    if (response.statusCode === 200) {
                        const result = data.map((nexusObj) => this.translateFromNexus(nexusObj, gameId));
                        resolve(result);
                    }
                    else {
                        reject(new Error(util.inspect(data)));
                    }
                });
                request.on('requestTimeout', () => reject(new Error('request timeout')));
                request.on('responseTimeout', () => reject(new Error('response timeout')));
                request.on('error', (err) => {
                    reject(err);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    queryServerHashMeta(server, hash) {
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
        else if (input === 'falloutnv') {
            return 'newvegas';
        }
        else {
            return input;
        }
    }
    readRange(type, key, terminate = true) {
        return new Promise((resolve, reject) => {
            const result = [];
            let stream;
            if (terminate) {
                stream = this.mDB.createReadStream({
                    gte: type + ':' + key + ':',
                    lt: type + ':' + key + 'a:',
                });
            }
            else {
                stream = this.mDB.createReadStream({
                    gte: type + ':' + key,
                    lte: type + ':' + key + 'zzzzzzzzzzzzzzzzzzz:',
                });
            }
            stream.on('data', (data) => result.push(data));
            stream.on('error', (err) => reject(err));
            stream.on('end', () => resolve(result));
        });
    }
    getAllByKey(key, gameId) {
        if (this.mBlacklist.has(JSON.stringify({ key, gameId }))) {
            return Promise.resolve([]);
        }
        return this.readRange('hash', key)
            .then((results) => {
            if (results.length > 0) {
                return Promise.resolve(results);
            }
            const hash = key.split(':')[0];
            let remoteResults;
            return Promise.mapSeries(this.mServers, (server) => {
                if (remoteResults) {
                    return Promise.resolve();
                }
                return this.queryServerHash(server, gameId, hash)
                    .then((serverResults) => {
                    remoteResults = serverResults;
                    for (const result of remoteResults) {
                        const temp = Object.assign({}, result.value);
                        temp.expires = new Date().getTime() / 1000 +
                            server.cacheDurationSec;
                        this.insert(result.value);
                    }
                })
                    .catch(err => {
                    this.mLog('warn', 'failed to query by key', {
                        server: server.url, key, gameId, error: err.message.toString(),
                    });
                    this.mBlacklist.add(JSON.stringify({ key, gameId }));
                });
            }).then(() => Promise.resolve(remoteResults || []));
        });
    }
    resolveIndex(key) {
        return new Promise((resolve, reject) => this.mDB.get(key, (err, value) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(value);
            }
        }));
    }
    getAllByLogicalName(logicalName, versionMatch) {
        if (this.mBlacklist.has(JSON.stringify({ logicalName, versionMatch }))) {
            return Promise.resolve([]);
        }
        const versionFilter = res => semvish.satisfies(res.key.split(':')[2], versionMatch, false);
        return this.readRange('log', logicalName)
            .then((results) => Promise.map(results.filter(versionFilter), (indexResult) => this.resolveIndex(indexResult.value)))
            .then((results) => {
            if (results.length > 0) {
                return Promise.resolve(results);
            }
            let remoteResults;
            return Promise.mapSeries(this.mServers, (server) => {
                if (remoteResults) {
                    return Promise.resolve();
                }
                return this.queryServerLogical(server, logicalName, versionMatch)
                    .then((serverResults) => {
                    remoteResults = serverResults;
                    for (const result of remoteResults) {
                        const temp = Object.assign({}, result.value);
                        temp.expires = new Date().getTime() / 1000 +
                            server.cacheDurationSec;
                        this.insert(result.value);
                    }
                })
                    .catch(err => {
                    this.mLog('warn', 'failed to query by logical name', {
                        server: server.url, logicalName, versionMatch,
                        error: err.message.toString(),
                    });
                    this.mBlacklist.add(JSON.stringify({ logicalName, versionMatch }));
                });
            }).then(() => Promise.resolve(remoteResults || []));
        });
    }
    getAllByExpression(expression, versionMatch) {
        if (this.mBlacklist.has(JSON.stringify({ expression, versionMatch }))) {
            return Promise.resolve([]);
        }
        const filter = res => {
            const [type, fileName, version] = res.key.split(':');
            return minimatch(fileName, expression)
                && semvish.satisfies(version, versionMatch, false);
        };
        const staticPart = expression.split(/[?*]/)[0];
        return this.readRange('name', staticPart, false)
            .then((results) => Promise.map(results.filter(filter), (indexResult) => this.resolveIndex(indexResult.value)))
            .then((results) => {
            if (results.length > 0) {
                return Promise.resolve(results);
            }
            let remoteResults;
            return Promise.mapSeries(this.mServers, (server) => {
                if (remoteResults) {
                    return Promise.resolve();
                }
                return this.queryServerLogical(server, expression, versionMatch)
                    .then((serverResults) => {
                    remoteResults = serverResults;
                    for (const result of remoteResults) {
                        const temp = Object.assign({}, result.value);
                        temp.expires = new Date().getTime() / 1000 +
                            server.cacheDurationSec;
                        this.insert(result.value);
                    }
                })
                    .catch(err => {
                    this.mLog('warn', 'failed to query by expression', {
                        server: server.url, expression, versionMatch,
                        error: err.message.toString(),
                    });
                    this.mBlacklist.add(JSON.stringify({ expression, versionMatch }));
                });
            }).then(() => Promise.resolve(remoteResults || []));
        });
    }
    makeKey(mod) {
        return `hash:${mod.fileMD5}:${mod.fileSizeBytes}:${mod.gameId}:`;
    }
    makeNameLookup(mod) {
        return `name:${mod.fileName}:${mod.fileVersion}:`;
    }
    makeLogicalLookup(mod) {
        return `log:${mod.logicalFileName}:${mod.fileVersion}:`;
    }
    missingKeys(mod) {
        const actualKeys = new Set(Object.keys(mod));
        return this.mModKeys.filter(key => !actualKeys.has(key));
    }
    promisify() {
        this.mDB.getAsync = Promise.promisify(this.mDB.get);
        this.mDB.putAsync = Promise.promisify(this.mDB.put);
    }
}
exports.default = ModDB;
