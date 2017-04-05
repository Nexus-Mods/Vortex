"use strict";
const Promise = require("bluebird");
const fs = require("fs-extra-promise");
function genHash(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const { createHash } = require('crypto');
            let hash = createHash('md5');
            let size = 0;
            let stream = fs.createReadStream(filePath);
            stream.on('data', (data) => {
                hash.update(data);
                size += data.length;
            });
            stream.on('end', () => resolve({
                md5sum: hash.digest('hex'),
                numBytes: size,
            }));
            stream.on('error', (err) => {
                reject(err);
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
exports.genHash = genHash;
