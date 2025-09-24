/**
 * macOS-native implementation of vortexmt
 * Provides MD5 file hashing functionality using Node.js crypto module
 */

"use strict";

const fs = require("fs");
const { createHash } = require("crypto");
const { promisify } = require("util");
const stat = promisify(fs.stat);

/**
 * Calculate MD5 of a file.
 * Supported signatures:
 *  - Promise style: fileMD5(path, [progressCb]) -> Promise<string>
 *  - Callback style: fileMD5(path, cb, [progressCb]) where cb(err, digest)
 * In all cases this function returns a Promise<string>.
 */
async function fileMD5(filePath, arg2, arg3) {
  // Determine invocation style
  let cb = undefined;
  let progressCb = undefined;

  if (typeof arg2 === "function" && typeof arg3 === "function") {
    // Callback + progress
    cb = arg2;
    progressCb = arg3;
  } else if (typeof arg2 === "function" && arg3 === undefined) {
    // Ambiguous: treat as callback for backward compatibility
    cb = arg2;
  } else if (arg2 !== undefined) {
    // If arg2 is provided but not a function, ignore it (defensive)
    // and keep promise-style without progress
  }

  try {
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
            try { 
              progressCb(p > 1 ? 1 : p); 
            } catch (_) {
              // Ignore progress callback errors
            }
          }
        }
      });

      stream.on("error", (err) => {
        if (typeof cb === "function") {
          try { 
            cb(err); 
          } catch (_) {
            // Ignore callback errors
          }
        }
        reject(err);
      });

      stream.on("end", () => {
        try {
          const digest = hash.digest("hex");
          if (typeof progressCb === "function") {
            try { 
              progressCb(1); 
            } catch (_) {
              // Ignore progress callback errors
            }
          }
          if (typeof cb === "function") {
            try { 
              cb(null, digest); 
            } catch (_) {
              // Ignore callback errors
            }
          }
          resolve(digest);
        } catch (e) {
          if (typeof cb === "function") {
            try { 
              cb(e); 
            } catch (_) {
              // Ignore callback errors
            }
          }
          reject(e);
        }
      });
    });
  } catch (error) {
    // Handle file stat errors
    if (typeof cb === "function") {
      try { 
        cb(error); 
      } catch (_) {
        // Ignore callback errors
      }
    }
    throw error;
  }
}

module.exports = { fileMD5 };