/**
 * Captures native bsdiff-node performance baseline and reference patches.
 * Run BEFORE removing the native module:
 *   node extensions/collections/scripts/capture-native-baseline.cjs
 */

"use strict";

const bsdiff = require("../node_modules/bsdiff-node");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TEST_DATA_DIR = path.resolve(__dirname, "..", "test-data");
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

// Generate deterministic pseudo-random bytes
function generateBytes(size, seed) {
    const buf = Buffer.alloc(size);
    let state = seed;
    for (let i = 0; i < size; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        buf[i] = state & 0xff;
    }
    return buf;
}

// Create a modified version with scattered byte changes
function modifyBytes(buf, changePercent, seed) {
    const result = Buffer.from(buf);
    let state = seed;
    const numChanges = Math.max(1, Math.floor(buf.length * changePercent));
    for (let i = 0; i < numChanges; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        const pos = state % buf.length;
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        result[pos] = state & 0xff;
    }
    return result;
}

const TEST_CASES = [
    { name: "1kb-5pct", size: 1024, changePercent: 0.05, seed: 42 },
    { name: "10kb-5pct", size: 10240, changePercent: 0.05, seed: 100 },
    { name: "100kb-5pct", size: 102400, changePercent: 0.05, seed: 200 },
    { name: "1mb-5pct", size: 1048576, changePercent: 0.05, seed: 300 },
    { name: "10kb-1byte", size: 10240, changePercent: 0, seed: 400 },
];

async function runBaseline() {
    const results = {};

    for (const tc of TEST_CASES) {
        console.log(`Running: ${tc.name} (${tc.size} bytes)...`);

        const oldBuf = generateBytes(tc.size, tc.seed);
        let newBuf;
        if (tc.changePercent === 0) {
            // Single byte change
            newBuf = Buffer.from(oldBuf);
            newBuf[Math.floor(tc.size / 2)] ^= 0xff;
        } else {
            newBuf = modifyBytes(oldBuf, tc.changePercent, tc.seed + 1);
        }

        const oldPath = path.join(TEST_DATA_DIR, `${tc.name}-old.bin`);
        const newPath = path.join(TEST_DATA_DIR, `${tc.name}-new.bin`);
        const patchPath = path.join(TEST_DATA_DIR, `${tc.name}-native.diff`);
        const patchedPath = path.join(TEST_DATA_DIR, `${tc.name}-patched.bin`);

        fs.writeFileSync(oldPath, oldBuf);
        fs.writeFileSync(newPath, newBuf);

        // Diff
        const diffStart = performance.now();
        await bsdiff.diff(oldPath, newPath, patchPath, () => {});
        const diffMs = performance.now() - diffStart;

        const patchSize = fs.statSync(patchPath).size;

        // Patch
        const patchStart = performance.now();
        await bsdiff.patch(oldPath, patchedPath, patchPath);
        const patchMs = performance.now() - patchStart;

        // Verify round-trip
        const patchedBuf = fs.readFileSync(patchedPath);
        const match = patchedBuf.equals(newBuf);
        const oldMd5 = crypto.createHash("md5").update(oldBuf).digest("hex");
        const newMd5 = crypto.createHash("md5").update(newBuf).digest("hex");
        const patchedMd5 = crypto
            .createHash("md5")
            .update(patchedBuf)
            .digest("hex");

        results[tc.name] = {
            fileSize: tc.size,
            diffMs: Math.round(diffMs * 100) / 100,
            patchMs: Math.round(patchMs * 100) / 100,
            patchFileSize: patchSize,
            roundTripMatch: match,
            oldMd5,
            newMd5,
            patchedMd5,
        };

        // Clean up temp files (keep old, new, and patch for cross-compat testing)
        fs.unlinkSync(patchedPath);

        console.log(
            `  diff: ${results[tc.name].diffMs}ms, patch: ${results[tc.name].patchMs}ms, ` +
                `patchSize: ${patchSize}, match: ${match}`,
        );
    }

    fs.writeFileSync(
        path.join(TEST_DATA_DIR, "native-baseline.json"),
        JSON.stringify(results, null, 2) + "\n",
    );
    console.log("\nBaseline saved to test-data/native-baseline.json");
}

runBaseline().catch((err) => {
    console.error("Baseline capture failed:", err);
    process.exit(1);
});
