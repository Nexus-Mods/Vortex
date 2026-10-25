import crypto from "node:crypto";
// Parse an Epic .egstore binary manifest, list files with SHA1, and compare against disk.
// Usage: node epic-manifest.mjs <manifestPath> <installDir> [maxFiles]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [manifestPath, installDir, maxArg] = process.argv.slice(2);
const max = Number(maxArg ?? 1e9);
const raw = fs.readFileSync(manifestPath);

const magic = raw.readUInt32LE(0);
if (magic !== 0x44bec00c) {
  console.log("not binary manifest, first bytes:", raw.subarray(0, 16).toString());
  process.exit(1);
}
const headerSize = raw.readUInt32LE(4);
const sizeCompressed = raw.readUInt32LE(12);
const storedAs = raw.readUInt8(36);
const version = raw.readUInt32LE(37);
let body = raw.subarray(headerSize, headerSize + sizeCompressed);
if (storedAs & 1) body = zlib.inflateSync(body);
console.log(`manifest version ${version}, body ${body.length} bytes`);

let o = 0;
const u8 = () => body.readUInt8(o++);
const u32 = () => {
  const v = body.readUInt32LE(o);
  o += 4;
  return v;
};
const i32 = () => {
  const v = body.readInt32LE(o);
  o += 4;
  return v;
};
const fstr = () => {
  const n = i32();
  if (n === 0) return "";
  if (n < 0) {
    const s = body.toString("utf16le", o, o - n * 2 - 2);
    o += -n * 2;
    return s;
  }
  const s = body.toString("latin1", o, o + n - 1);
  o += n;
  return s;
};

// Meta: skip by declared size, but read app name and build version first.
const metaStart = o;
const metaSize = u32();
u8();
u32();
u8();
u32();
const appName = fstr();
const buildVersion = fstr();
console.log(`app ${appName}, build ${buildVersion}`);
o = metaStart + metaSize;

// Chunk data list: skip.
const cdlStart = o;
o = cdlStart + u32();

// File manifest list.
u32();
const fmlVersion = u8();
const count = u32();
const names = Array.from({ length: count }, fstr);
for (let i = 0; i < count; i++) fstr(); // symlink targets
const hashes = names.map(() => {
  const h = body.subarray(o, o + 20).toString("hex");
  o += 20;
  return h;
});
console.log(`FML version ${fmlVersion}, ${count} files\n`);

let ok = 0,
  changed = 0,
  missing = 0;
const changedList = [];
for (let i = 0; i < Math.min(count, max); i++) {
  const p = path.join(installDir, names[i]);
  if (!fs.existsSync(p)) {
    missing++;
    changedList.push(`MISSING ${names[i]}`);
    continue;
  }
  const h = crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex");
  if (h === hashes[i]) ok++;
  else {
    changed++;
    changedList.push(`CHANGED ${names[i]}`);
  }
}
console.log(`checked ${Math.min(count, max)}: ${ok} match, ${changed} changed, ${missing} missing`);
console.log(changedList.slice(0, 20).join("\n"));
console.log("\nsample entries:");
for (let i = 0; i < Math.min(5, count); i++) console.log(`  ${hashes[i]}  ${names[i]}`);
