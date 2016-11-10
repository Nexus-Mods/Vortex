"use strict";
const Promise = require('bluebird');
const path = require('path');
const levelup = require('levelup');
const util_1 = require('./util');
class ModDB {
    constructor(location) {
        this.mDB =
            levelup(path.join(location, 'mods.ldb'), { valueEncoding: 'json' });
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
        this.promisify();
    }
    getByKey(key) {
        return this.getAllByKey(key);
    }
    insert(mod) {
        let missingKeys = this.missingKeys(mod);
        if (missingKeys.length !== 0) {
            return Promise.reject({
                message: 'Invalid mod object',
                missing_keys: missingKeys,
            });
        }
        return this.mDB.putAsync(this.makeKey(mod), mod);
    }
    lookup(filePath, gameId, modId) {
        return util_1.genHash(filePath).then((res) => {
            let lookupKey = `${res.md5sum}:${res.numBytes}`;
            if (gameId !== undefined) {
                lookupKey += ':' + gameId;
                if (modId !== undefined) {
                    lookupKey += ':' + modId;
                }
            }
            console.log('looking up mod', lookupKey);
            return this.getAllByKey(lookupKey);
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
                console.log('got data', data);
                result.push(data);
            });
            stream.on('error', (err) => {
                console.log('error looking up key', key);
                reject(err);
            });
            stream.on('end', () => {
                console.log('done');
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
