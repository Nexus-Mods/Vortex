// usage: node gog-manifest.mjs <installDir> [--hash] [--max N] [--db <copy of galaxy-2.0.db>] [--build <buildId>] [--all-langs]
//
// Compares a GOG game folder against the file list for its installed build.
// Default source: GOG's public content system (no login). Reads goggame-*.info in the
// folder for product ids, buildId and language, looks the build up in
// content-system.gog.com/products/<id>/os/windows/builds?generation=2, then fetches the
// zlib JSON build manifest and depot manifests from gog-cdn-fastly.gog.com.
// --db reads the GameFiles and GameFileChunkHashes tables from a COPY of Galaxy's
// galaxy-2.0.db instead (never open the live one). --hash MD5s files whose size matches.
// Read-only: it never writes to the game folder.
import { createHash } from "node:crypto";
import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const installDir = args[0];
if (!installDir || installDir.startsWith("--")) {
  console.error(
    "usage: node gog-manifest.mjs <installDir> [--hash] [--max N] [--db <galaxy-2.0.db copy>] [--build <buildId>] [--all-langs]",
  );
  process.exit(1);
}
const maxShow = Number(opt("--max") ?? 20);

// goggame-<id>.info: JSON, but buildId can pass 2^53, so quote numeric ids before parsing.
const parseBig = (t) =>
  JSON.parse(t.replace(/"(buildId|build_id|gameId|rootGameId)":\s*(\d+)/g, '"$1":"$2"'));
const infos = readdirSync(installDir)
  .filter((f) => /^goggame-\d+\.info$/i.test(f))
  .map((f) => parseBig(readFileSync(join(installDir, f), "utf8")));
if (infos.length === 0) throw new Error("no goggame-*.info in folder");
const root = infos.find((i) => i.gameId === i.rootGameId) ?? infos[0];
const productIds = new Set(infos.map((i) => String(i.gameId)));
const languages = new Set(root.languages ?? []);
const buildId = opt("--build") ?? root.buildId;
console.log(
  `root ${root.gameId} "${root.name}" build ${buildId} languages [${[...languages]}] products [${[...productIds]}]`,
);

const EMPTY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";
const key = (p) => p.replace(/\//g, "\\").replace(/^\\/, "").toLowerCase();

async function getZlibJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return parseBig(zlib.inflateSync(buf).toString());
}
const metaUrl = (h) =>
  `https://gog-cdn-fastly.gog.com/content-system/v2/meta/${h.slice(0, 2)}/${h.slice(2, 4)}/${h}`;

async function findBuild() {
  const tried = [];
  for (const gen of [2, 1]) {
    const url = `https://content-system.gog.com/products/${root.rootGameId}/os/windows/builds?generation=${gen}`;
    const builds = parseBig(
      (await (await fetch(url)).text()).replace(
        /"legacy_build_id":\s*(\d+)/g,
        '"legacy_build_id":"$1"',
      ),
    );
    const item = builds.items.find((b) => b.build_id === buildId || b.legacy_build_id === buildId);
    if (item) return item;
    tried.push(`${url} (lists ${builds.count} of ${builds.total_count})`);
  }
  throw new Error(
    `build ${buildId} not found in:\n  ${tried.join("\n  ")}\nmanifest hash unknown; try --db`,
  );
}

// Generation 1: plain JSON repository.json; each depot's file list sits next to it.
// Languages are names ("English", "Neutral"), files have path, size and an MD5 "hash".
async function fromCdnGen1(item) {
  const repo = await (await fetch(item.link)).json();
  const dir = item.link.slice(0, item.link.lastIndexOf("/") + 1);
  const lang = root.language ?? "English";
  const depots = repo.product.depots.filter(
    (d) =>
      d.manifest &&
      d.gameIDs.some((g) => productIds.has(String(g))) &&
      (flag("--all-langs") || d.languages.includes("Neutral") || d.languages.includes(lang)),
  );
  console.log(
    `gen 1 depots: ${depots.length} used of ${repo.product.depots.filter((d) => d.manifest).length}`,
  );
  const files = new Map();
  for (const d of depots) {
    const m = await (await fetch(dir + d.manifest)).json();
    for (const f of m.depot.files) {
      if (f.directory || f.support) continue; // support files are installer helpers, not game files
      const path = f.path.replace(/^\//, "");
      files.set(key(path), { path, size: f.size, md5: f.hash, product: d.gameIDs[0] });
    }
  }
  return files;
}

async function fromCdn() {
  const item = await findBuild();
  console.log(`build ${item.build_id} "${item.version_name}" gen ${item.generation} ${item.link}`);
  if (item.generation === 1) return fromCdnGen1(item);
  const build = await getZlibJson(item.link);
  if (build.version !== 2) throw new Error(`unexpected build manifest version ${build.version}`);
  const wantLang = (l) => flag("--all-langs") || l.includes("*") || l.some((x) => languages.has(x));
  const depots = build.depots.filter(
    (d) => productIds.has(String(d.productId)) && wantLang(d.languages),
  );
  const skipped = build.depots.length - depots.length;
  console.log(
    `depots: ${depots.length} used, ${skipped} skipped (other language or product not installed)`,
  );
  const files = new Map();
  for (const d of depots) {
    const m = await getZlibJson(metaUrl(d.manifest));
    for (const it of m.depot.items) {
      if (it.type !== "DepotFile") continue;
      const size = it.sfcRef ? it.sfcRef.size : it.chunks.reduce((a, c) => a + c.size, 0);
      // whole-file md5 is only given when it differs from the single chunk's md5;
      // zero-byte files have no chunks at all
      const md5 =
        it.md5 ??
        (it.chunks.length === 1
          ? it.chunks[0].md5
          : it.chunks.length === 0
            ? EMPTY_MD5
            : undefined);
      files.set(key(it.path), { path: it.path, size, md5, product: d.productId });
    }
  }
  return files;
}

async function fromDb(dbPath) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const ids = [...productIds].map(Number);
  const rows = db
    .prepare(
      `select g.installPath p, g.hash h, g.productId pid, sum(c.size) s from GameFiles g
       left join GameFileChunkHashes c on c.productFileId = g.id
       where g.productId in (${ids.map(() => "?").join(",")}) group by g.id`,
    )
    .all(...ids);
  const files = new Map();
  for (const r of rows)
    files.set(key(r.p), { path: r.p, size: Number(r.s ?? 0), md5: r.h, product: r.pid });
  return files;
}

function md5File(p) {
  return new Promise((res, rej) => {
    const h = createHash("md5");
    createReadStream(p, { highWaterMark: 4 << 20 })
      .on("data", (d) => h.update(d))
      .on("end", () => res(h.digest("hex")))
      .on("error", rej);
  });
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const dbPath = opt("--db");
const files = dbPath ? await fromDb(dbPath) : await fromCdn();
console.log(`source: ${dbPath ? "Galaxy DB copy" : "GOG CDN"}, ${files.size} files listed`);

const missing = [],
  sizeDiff = [],
  hashDiff = [],
  noHash = [];
let matched = 0,
  bytes = 0;
const t0 = Date.now();
for (const f of files.values()) {
  const p = join(installDir, f.path.replace(/\//g, "\\"));
  let st;
  try {
    st = statSync(p);
  } catch {
    missing.push(f.path);
    continue;
  }
  if (st.size !== f.size) {
    sizeDiff.push(`${f.path} (expected ${f.size}, found ${st.size})`);
    continue;
  }
  if (!flag("--hash")) {
    matched++;
    continue;
  }
  if (!f.md5) {
    noHash.push(f.path);
    continue;
  }
  bytes += st.size;
  if ((await md5File(p)) === f.md5) matched++;
  else hashDiff.push(f.path);
}
const extras = walk(installDir)
  .map((p) => relative(installDir, p))
  .filter((r) => !files.has(key(r)));

const show = (label, list) => {
  console.log(`${label}: ${list.length}`);
  for (const x of list.slice(0, maxShow)) console.log(`  ${x}`);
  if (list.length > maxShow) console.log(`  ... ${list.length - maxShow} more`);
};
console.log(
  `\n${flag("--hash") ? "matched size and MD5" : "matched size"}: ${matched} of ${files.size}` +
    (flag("--hash")
      ? ` (hashed ${(bytes / 2 ** 30).toFixed(1)} GiB in ${((Date.now() - t0) / 1000).toFixed(0)} s)`
      : ""),
);
show("missing", missing);
show("size differs", sizeDiff);
if (flag("--hash")) {
  show("MD5 differs", hashDiff);
  show("no MD5 in source", noHash);
}
show("on disk but not listed", extras);
