// usage: node xbox-manifest.mjs <installDir> [--hash] [--max N]
//
// Compares an Xbox app / PC Game Pass (GDK, MSIXVC) game folder against the file list the
// installer leaves next to it. <installDir> is the folder holding Content\ (for example
// C:\XboxGames\Hades II), or the Content folder itself.
// Reads <contentId>.smd (XVC segment metadata: every file's path and size, in package order)
// and <contentId> (the package's first bytes: XVD header, block hash tree, NTFS metadata).
// --hash checks files against the hash tree. That only works for files stored unencrypted in
// the package (the registration files: logos, MicrosoftGame.Config, appxmanifest.xml and so on).
// Every other block is hashed as ciphertext, so those files get a size check only.
// Read-only: it never writes to the game folder.
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, sep } from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
let installDir = args[0];
if (!installDir || installDir.startsWith("--")) {
  console.error("usage: node xbox-manifest.mjs <installDir> [--hash] [--max N]");
  process.exit(1);
}
if (basename(installDir).toLowerCase() === "content") installDir = dirname(installDir);
const contentDir = join(installDir, "Content");
const maxShow = Number(opt("--max") ?? 20);

const BLOCK = 4096;
const ENTRY = 24; // truncated SHA-256
const PER_PAGE = Math.floor(BLOCK / ENTRY); // 170 entries per 4 KiB hash page

// .smd: " PFX" magic, u32 version x2, u32 header length, u32 segment count, u32 path table
// length, PDUID guid; then 16-byte records (u16 flags, u16 path length in chars,
// u32 path offset, u64 size); then a UTF-16 path table. Flag 1 is set on executables.
function parseSmd(file) {
  const b = readFileSync(file);
  if (b.toString("latin1", 0, 4) !== " PFX") throw new Error(`${file}: not XVC segment metadata`);
  const headerLength = b.readUInt32LE(12);
  const count = b.readUInt32LE(16);
  const pathBase = headerLength + count * 16;
  const files = [];
  for (let i = 0; i < count; i++) {
    const o = headerLength + i * 16;
    const flags = b.readUInt16LE(o);
    const chars = b.readUInt16LE(o + 2);
    const at = pathBase + b.readUInt32LE(o + 4);
    files.push({
      path: b.toString("utf16le", at, at + chars * 2),
      size: Number(b.readBigUInt64LE(o + 8)),
      flags,
    });
  }
  return files;
}

const smdName = readdirSync(installDir).find((f) => /^[0-9a-f-]{36}\.smd$/i.test(f));
if (!smdName) throw new Error(`no <contentId>.smd in ${installDir}`);
const contentId = smdName.slice(0, -4);
const files = parseSmd(join(installDir, smdName));
const treePath = join(installDir, contentId);
const tree = flag("--hash") && existsSync(treePath) ? readFileSync(treePath) : undefined;

const config = readFileSync(join(contentDir, "MicrosoftGame.Config"), "utf8");
const version = /<Identity[^>]*\sVersion="([^"]+)"/.exec(config)?.[1];
console.log(`content id ${contentId}, version ${version}, ${files.length} files listed`);

const readBlock = (fd, size, i) => {
  const b = Buffer.alloc(BLOCK);
  readSync(fd, b, 0, Math.min(BLOCK, size - i * BLOCK), i * BLOCK);
  return createHash("sha256").update(b).digest().subarray(0, ENTRY);
};

// Level-0 hash pages: find the page holding block 0 by searching for the first file's block hash,
// then assume the pages run on from there in .smd order, one block range per file.
let level0 = -1;
if (tree) {
  const first = files.find((f) => f.size > 0);
  const fd = openSync(join(contentDir, first.path), "r");
  level0 = tree.indexOf(readBlock(fd, first.size, 0));
  closeSync(fd);
  if (level0 < 0) console.log("first file's block hash not in the tree; skipping --hash");
}
const entry = (blk) =>
  tree
    .subarray(level0 + Math.floor(blk / PER_PAGE) * BLOCK + (blk % PER_PAGE) * ENTRY)
    .subarray(0, ENTRY);

const missing = [];
const changedSize = [];
const unreadable = [];
const hashMismatch = [];
let hashVerified = 0;
let sizeOnly = 0;
let blk = 0;
const t0 = Date.now();
for (const f of files) {
  const first = blk;
  blk += Math.ceil(f.size / BLOCK);
  const p = join(contentDir, f.path);
  let st;
  try {
    st = statSync(p);
  } catch {
    missing.push(f.path);
    continue;
  }
  if (st.size !== f.size) {
    changedSize.push(`${f.path} (${st.size}, listed ${f.size})`);
    continue;
  }
  let fd;
  try {
    fd = openSync(p, "r");
  } catch (e) {
    unreadable.push(`${f.path} (${e.code})`);
    continue;
  }
  if (level0 >= 0 && f.size > 0 && readBlock(fd, f.size, 0).equals(entry(first))) {
    let ok = true;
    for (let i = 1; ok && i < Math.ceil(f.size / BLOCK); i++)
      ok = readBlock(fd, f.size, i).equals(entry(first + i));
    if (ok) hashVerified++;
    else hashMismatch.push(f.path);
  } else sizeOnly++;
  closeSync(fd);
}

function walk(dir, rel = "", out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + sep + e.name : e.name;
    if (e.isDirectory()) walk(join(dir, e.name), r, out);
    else out.push(r);
  }
  return out;
}
const listed = new Set(files.map((f) => f.path.toLowerCase()));
const extras = walk(contentDir).filter((r) => !listed.has(r.toLowerCase()));

const show = (label, list) => {
  console.log(`${label}: ${list.length}`);
  for (const l of list.slice(0, maxShow)) console.log(`  ${l}`);
  if (list.length > maxShow) console.log(`  ... ${list.length - maxShow} more`);
};
show("missing", missing);
show("size differs", changedSize);
show("can't open", unreadable);
show("not in list", extras);
if (tree) {
  console.log(`hash verified against the tree: ${hashVerified}, size match only: ${sizeOnly}`);
  show("hash differs", hashMismatch);
}
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
