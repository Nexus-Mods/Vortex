"use strict";

const fs = require("fs");
const { createHash } = require("crypto");
const { promisify } = require("util");
const stat = promisify(fs.stat);

/**
 * Calculate MD5 of a file with optional progress callback.
 * Signature matches upstream: fileMD5(path, [progressCb]) -> Promise<string>
 * progressCb receives a number in [0,1].
 */
async function fileMD5(filePath, progressCb) {
    const info = await stat(filePath);
    const total = info.size;
    const stream = fs.createReadStream(filePath);
    const hash = createHash("md5");

    let processed = 0;
    let lastEmit = 0;

    return await new Promise((resolve, reject) => {
        stream.on("data", (chunk) => {
            hash.update(chunk);
            processed += chunk.length;

            if (typeof progressCb === "function") {
                const now = Date.now();
                if (now - lastEmit > 100 || processed === total) {
                    lastEmit = now;
                    const p = total > 0 ? processed / total : 1;
                    try { progressCb(p > 1 ? 1 : p); } catch (_) {}
                }
            }
        });

        stream.on("error", reject);

        stream.on("end", () => {
            try {
                const digest = hash.digest("hex");
                if (typeof progressCb === "function") {
                    try { progressCb(1); } catch (_) {}
                }
                resolve(digest);
            } catch (e) {
                reject(e);
            }
        });
    });
}

module.exports = { fileMD5 };
