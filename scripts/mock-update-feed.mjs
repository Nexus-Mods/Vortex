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
 * signed build; this covers resolve -> notify -> download.)
 *
 * Usage:
 *   node scripts/mock-update-feed.mjs [--port 9877] [--fixture path.json] [--installer path.exe] [--assets dir] [--throttle MBps]
 *
 * --throttle caps asset transfer speed (megabytes per second) so a download
 * from localhost takes long enough to watch the progress UI; e.g. --throttle 20
 * stretches a 365 MB installer to about 18 seconds.
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
const throttleMBps = Number(arg("throttle", "0"));

// Writes a body either in one go or, when throttled, in ten slices per
// second sized to the requested rate.
function sendBody(res, body) {
  if (!(throttleMBps > 0)) {
    res.end(body);
    return;
  }
  const chunk = Math.max(1, Math.floor((throttleMBps * 1024 * 1024) / 10));
  let offset = 0;
  const tick = () => {
    if (res.destroyed) {
      return;
    }
    const end = Math.min(offset + chunk, body.length);
    res.write(body.subarray(offset, end));
    offset = end;
    if (offset >= body.length) {
      res.end();
    } else {
      setTimeout(tick, 100);
    }
  };
  tick();
}

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

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  const listing = /^\/repos\/Nexus-Mods\/[^/]+\/releases$/.exec(url.pathname);
  if (listing != null) {
    console.log(
      `${req.method} ${url.pathname} -> 200 (release listing, ${releases.length} releases)`,
    );
    res.writeHead(200, { "content-type": "application/json", etag: '"mock-feed"' });
    res.end(JSON.stringify(releases));
    return;
  }

  const download = /^\/Nexus-Mods\/[^/]+\/releases\/download\/([^/]+)\/(.+)$/.exec(url.pathname);
  if (download != null) {
    const [, tag, asset] = download;
    const label = `${req.method} ${tag}/${asset}`;
    // real files win over generated dummies (needed for blockmap testing:
    // blockmaps must match the actual installer bytes); a per-tag
    // subdirectory wins over the flat dir, so tag-specific files that share
    // a name across releases (latest.yml) can coexist. Reject ".."-bearing
    // segments outright, the character class alone would admit them.
    const safeSegment = (segment) => /^[\w.-]+$/.test(segment) && !segment.includes("..");
    if (assetsDir != null && safeSegment(asset) && safeSegment(tag)) {
      try {
        let content;
        let source;
        try {
          content = readFileSync(path.join(assetsDir, tag, asset));
          source = `assets\\${tag}`;
        } catch {
          content = readFileSync(path.join(assetsDir, asset));
          source = "assets";
        }
        // the differential downloader fetches byte ranges of the installer
        const range = /^bytes=(\d+)-(\d+)?$/.exec(req.headers.range ?? "");
        if (range != null) {
          const start = Number(range[1]);
          const end = Math.min(
            range[2] != null ? Number(range[2]) : content.length - 1,
            content.length - 1,
          );
          if (start >= content.length || start > end) {
            console.log(`${label} -> 416 (unsatisfiable range ${req.headers.range})`);
            res.writeHead(416, { "content-range": `bytes */${content.length}` });
            res.end();
            return;
          }
          const slice = content.subarray(start, end + 1);
          console.log(
            `${label} -> 206 bytes ${start}-${end} (${fmtSize(slice.length)}) [${source}]`,
          );
          res.writeHead(206, {
            "content-type": "application/octet-stream",
            "content-length": slice.length,
            "content-range": `bytes ${start}-${end}/${content.length}`,
            "accept-ranges": "bytes",
          });
          sendBody(res, slice);
          return;
        }
        console.log(`${label} -> 200 full file (${fmtSize(content.length)}) [${source}]`);
        res.writeHead(200, {
          "content-type": "application/octet-stream",
          "content-length": content.length,
          "accept-ranges": "bytes",
        });
        sendBody(res, content);
        return;
      } catch {
        // fall through to generated assets / 404
      }
    }
    if (asset.endsWith(".blockmap")) {
      // no real blockmap available: 404 exercises the full-download fallback
      console.log(`${label} -> 404 (no blockmap on disk; full-download fallback)`);
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("no blockmap");
      return;
    }
    if (asset === "latest.yml") {
      console.log(`${label} -> 200 (generated latest.yml for ${tag})`);
      res.writeHead(200, { "content-type": "text/yaml" });
      res.end(latestYmlForTag(tag));
      return;
    }
    if (asset.toLowerCase().endsWith(".exe")) {
      console.log(`${label} -> 200 (generated dummy installer, ${fmtSize(installerBytes.length)})`);
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": installerBytes.length,
      });
      res.end(installerBytes);
      return;
    }
  }

  console.log(`${req.method} ${url.pathname} -> 404`);
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

// loopback only: without an explicit host Node binds 0.0.0.0, exposing the
// assets directory to the local network
server.listen(port, "127.0.0.1", () => {
  console.log(`mock update feed on http://localhost:${port}`);
  console.log(`  fixture: ${fixturePath} (${releases.length} releases)`);
  console.log(`  installer: ${installerPath ?? "generated dummy bytes"}`);
  console.log("run Vortex with:");
  console.log(`  VORTEX_UPDATER_API_BASE=http://localhost:${port}`);
  console.log(`  VORTEX_UPDATER_DOWNLOAD_BASE=http://localhost:${port}`);
});
