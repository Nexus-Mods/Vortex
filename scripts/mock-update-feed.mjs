/**
 * Local mock of the GitHub releases API + release assets, for live-testing
 * the auto-updater without touching GitHub.
 *
 * Serves:
 *   GET /repos/Nexus-Mods/<repo>/releases            release listing (fixture)
 *   GET /Nexus-Mods/<repo>/releases/download/<tag>/latest.yml
 *   GET /Nexus-Mods/<repo>/releases/download/<tag>/<installer>.exe
 *
 * latest.yml and a dummy installer are generated per release tag with a
 * matching sha512, so electron-updater's download + hash verification pass.
 * (Authenticode verification and the actual install still need a packaged,
 * signed build — this covers resolve → notify → download.)
 *
 * Usage:
 *   node scripts/mock-update-feed.mjs [--port 9877] [--fixture path.json] [--installer path.exe] [--assets dir]
 *
 * --assets serves real files (installers and their .exe.blockmap siblings)
 * by exact name from a directory, taking precedence over the generated
 * dummies. Point it at two packaged builds' dist output to exercise the
 * differential (blockmap) download path end to end: electron-updater logs
 * "Download block maps (old..., new...)" when it engages, and falls back to
 * a full download when a blockmap 404s.
 *
 * Then run Vortex with:
 *   VORTEX_UPDATER_API_BASE=http://localhost:9877
 *   VORTEX_UPDATER_DOWNLOAD_BASE=http://localhost:9877
 *
 * The default fixture is the resolver test fixture (the real interleaved
 * release scenario). Edit a copy to reproduce field reports: set the release
 * list to what the user saw and watch what the updater does.
 * --installer serves a real exe (e.g. a locally built vortex-setup) instead
 * of dummy bytes, which lets a packaged build complete a full update cycle.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] != null ? argv[index + 1] : fallback;
}

const port = Number(arg("port", "9877"));
const fixturePath = arg(
  "fixture",
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "main",
    "src",
    "extensions",
    "autoupdater",
    "__fixtures__",
    "releases.json",
  ),
);
const installerPath = arg("installer", null);
const assetsDir = arg("assets", null);

const releases = JSON.parse(readFileSync(fixturePath, "utf8"));
const installerBytes =
  installerPath != null
    ? readFileSync(installerPath)
    : Buffer.from(`mock vortex installer ${Date.now()}`);
const installerSha512 = createHash("sha512").update(installerBytes).digest("base64");

function installerNameForTag(tag) {
  return `vortex-setup-${tag.replace(/^v/, "")}.exe`;
}

function latestYmlForTag(tag) {
  const name = installerNameForTag(tag);
  const version = tag.replace(/^v/, "");
  return [
    `version: ${version}`,
    "files:",
    `  - url: ${name}`,
    `    sha512: ${installerSha512}`,
    `    size: ${installerBytes.length}`,
    `path: ${name}`,
    `sha512: ${installerSha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    "",
  ].join("\n");
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  console.log(`${req.method} ${url.pathname}`);

  const listing = /^\/repos\/Nexus-Mods\/[^/]+\/releases$/.exec(url.pathname);
  if (listing != null) {
    res.writeHead(200, { "content-type": "application/json", etag: '"mock-feed"' });
    res.end(JSON.stringify(releases));
    return;
  }

  const download = /^\/Nexus-Mods\/[^/]+\/releases\/download\/([^/]+)\/(.+)$/.exec(url.pathname);
  if (download != null) {
    const [, tag, asset] = download;
    // real files win over generated dummies (needed for blockmap testing:
    // blockmaps must match the actual installer bytes); a per-tag
    // subdirectory wins over the flat dir, so tag-specific files that share
    // a name across releases (latest.yml) can coexist
    if (assetsDir != null && /^[\w.-]+$/.test(asset) && /^[\w.-]+$/.test(tag)) {
      try {
        let content;
        try {
          content = readFileSync(path.join(assetsDir, tag, asset));
        } catch {
          content = readFileSync(path.join(assetsDir, asset));
        }
        // the differential downloader fetches byte ranges of the installer
        const range = /^bytes=(\d+)-(\d+)?$/.exec(req.headers.range ?? "");
        if (range != null) {
          const start = Number(range[1]);
          const end = range[2] != null ? Number(range[2]) : content.length - 1;
          const slice = content.subarray(start, end + 1);
          res.writeHead(206, {
            "content-type": "application/octet-stream",
            "content-length": slice.length,
            "content-range": `bytes ${start}-${end}/${content.length}`,
            "accept-ranges": "bytes",
          });
          res.end(slice);
          return;
        }
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": content.length,
          "accept-ranges": "bytes",
        });
        res.end(content);
        return;
      } catch {
        // fall through to generated assets / 404
      }
    }
    if (asset.endsWith(".blockmap")) {
      // no real blockmap available: 404 exercises the full-download fallback
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("no blockmap");
      return;
    }
    if (asset === "latest.yml") {
      res.writeHead(200, { "content-type": "text/yaml" });
      res.end(latestYmlForTag(tag));
      return;
    }
    if (asset.toLowerCase().endsWith(".exe")) {
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": installerBytes.length,
      });
      res.end(installerBytes);
      return;
    }
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(port, () => {
  console.log(`mock update feed on http://localhost:${port}`);
  console.log(`  fixture: ${fixturePath} (${releases.length} releases)`);
  console.log(`  installer: ${installerPath ?? "generated dummy bytes"}`);
  console.log("run Vortex with:");
  console.log(`  VORTEX_UPDATER_API_BASE=http://localhost:${port}`);
  console.log(`  VORTEX_UPDATER_DOWNLOAD_BASE=http://localhost:${port}`);
});
