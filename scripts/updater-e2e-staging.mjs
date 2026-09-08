/**
 * Staging dress rehearsal for the auto-updater, against a real GitHub repo.
 *
 * Publishes fixture releases to a SCRATCH repo (never the live Vortex or
 * Vortex-Staging repos) so a packaged Vortex, pointed at it via
 * VORTEX_UPDATER_REPO=owner/repo, exercises the GitHub-specific edges the
 * local mock feed can't: real API shapes, the objects.githubusercontent.com
 * CDN redirect, rate limiting, prerelease/draft semantics, and signature
 * verification with CI-signed installers.
 *
 * Assets come from the draft releases CI parks on Vortex-Staging (dispatch
 * .github/workflows/package.yml with staging-release on, release and
 * upload-to-r2 off). Drafts are invisible to unauthenticated clients, so
 * nothing real users can see is ever touched.
 *
 * Usage (requires gh, authenticated):
 *   node scripts/updater-e2e-staging.mjs setup --repo owner/scratch --versions v9.0.0,v9.0.1
 *   node scripts/updater-e2e-staging.mjs teardown --repo owner/scratch
 *
 * setup:
 *   - seeds the scratch repo with a README if it has no commits yet (GitHub
 *     can't tag, and so can't release, on an empty repo)
 *   - downloads each version's assets from the Vortex-Staging draft with the
 *     same tag (installer, latest.yml, blockmap)
 *   - creates the release on the scratch repo, prerelease flag derived from
 *     the version (contains "-" = prerelease), IN ARGUMENT ORDER, so listing
 *     a newer beta before an older stable recreates the interleaved-dates
 *     scenario that caused the original field bug
 *   - releases are tagged in the body so teardown only ever deletes its own
 * teardown:
 *   - deletes every release (and tag) on the scratch repo whose body carries
 *     the marker
 *
 * Options:
 *   --repo owner/name      scratch repo (required)
 *   --source owner/name    where CI parked the drafts (default Nexus-Mods/Vortex-Staging)
 *   --versions a,b,c       tags to publish, in publish order (setup only)
 *   --keep-drafts          leave the source drafts in place (default: leave them)
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

const MARKER = "updater-e2e-rehearsal";

const argv = process.argv.slice(2);
const command = argv[0];

function opt(name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] != null ? argv[index + 1] : fallback;
}

function gh(args, opts = {}) {
  return execFileSync("gh", args, { encoding: "utf8", ...opts });
}

const repo = opt("repo");
const source = opt("source", "Nexus-Mods/Vortex-Staging");

function usage(message) {
  console.error(message);
  console.error(
    "usage: node scripts/updater-e2e-staging.mjs setup|teardown --repo owner/scratch [--versions v9.0.0,v9.0.1] [--source owner/name]",
  );
  process.exit(1);
}

if (repo == null || !repo.includes("/")) {
  usage("--repo owner/name is required");
}
if (/Nexus-Mods\/(Vortex|Vortex-Staging)$/i.test(repo)) {
  usage(`refusing to publish rehearsal releases to the live repo ${repo}; use a scratch repo`);
}

// A release needs a tag and a tag needs a commit, so a brand-new scratch repo
// makes `gh release create` fail with "422 Repository is empty". Seed a README.
function ensureRepoHasCommit() {
  try {
    gh(["api", `repos/${repo}/commits?per_page=1`], { stdio: ["ignore", "pipe", "ignore"] });
    return;
  } catch {
    // 409 for an empty repo; anything else will resurface on the first release create
  }
  console.log(`# ${repo} is empty, seeding a README so releases can be tagged`);
  const readme = [
    `# ${repo.split("/")[1]}`,
    "",
    "Scratch repo for Vortex auto-updater rehearsals. Releases here are throwaway",
    "test fixtures published by `scripts/updater-e2e-staging.mjs` in Nexus-Mods/Vortex;",
    "they are not real Vortex builds.",
    "",
  ].join("\n");
  gh(
    [
      "api",
      "-X",
      "PUT",
      `repos/${repo}/contents/README.md`,
      "-f",
      "message=seed for updater rehearsal releases",
      "-f",
      `content=${Buffer.from(readme).toString("base64")}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

function setup() {
  const versions = (opt("versions") ?? "").split(",").filter(Boolean);
  if (versions.length === 0) {
    usage("setup needs --versions (comma-separated tags, in publish order)");
  }

  ensureRepoHasCommit();

  for (const tag of versions) {
    const version = tag.replace(/^v/, "");
    const prerelease = version.includes("-");
    const dir = mkdtempSync(path.join(tmpdir(), `updater-e2e-${version}-`));

    console.log(`# ${tag}: downloading assets from ${source} draft`);
    gh(["release", "download", tag, "--repo", source, "--dir", dir], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    const assets = readdirSync(dir).map((name) => path.join(dir, name));
    const names = assets.map((file) => path.basename(file));
    const missing = ["latest.yml"].filter((needed) => !names.includes(needed));
    if (missing.length > 0 || !names.some((name) => name.endsWith(".exe"))) {
      throw new Error(`${tag}: draft on ${source} is missing assets (have: ${names.join(", ")})`);
    }
    if (!names.some((name) => name.endsWith(".blockmap"))) {
      console.warn(
        `${tag}: no blockmap in the draft; differential downloads will fall back to full`,
      );
    }

    console.log(`# ${tag}: publishing on ${repo} (prerelease: ${prerelease})`);
    gh(
      [
        "release",
        "create",
        tag,
        "--repo",
        repo,
        "--title",
        version,
        "--notes",
        `Rehearsal release for ${version}.\n\n<!-- ${MARKER} -->`,
        ...(prerelease ? ["--prerelease"] : []),
        "--latest=false",
        ...assets,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );

    rmSync(dir, { recursive: true, force: true });
  }

  console.log("\ndone. point a packaged Vortex at it with:");
  console.log(`  [Environment]::SetEnvironmentVariable("VORTEX_UPDATER_REPO", "${repo}", "User")`);
  console.log("and make sure VORTEX_UPDATER_API_BASE / VORTEX_UPDATER_DOWNLOAD_BASE are cleared");
  console.log("(the rehearsal must hit real GitHub). Clear VORTEX_UPDATER_REPO when finished.");
}

function teardown() {
  const listing = JSON.parse(
    gh(["release", "list", "--repo", repo, "--limit", "100", "--json", "tagName", "--jq", "."]),
  );
  let deleted = 0;
  for (const entry of listing) {
    const body = gh([
      "release",
      "view",
      entry.tagName,
      "--repo",
      repo,
      "--json",
      "body",
      "--jq",
      ".body",
    ]);
    if (!body.includes(MARKER)) {
      console.log(`# skipping ${entry.tagName}: not a rehearsal release`);
      continue;
    }
    console.log(`# deleting ${entry.tagName}`);
    gh(["release", "delete", entry.tagName, "--repo", repo, "--cleanup-tag", "--yes"], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    deleted += 1;
  }
  console.log(`\ndone. deleted ${deleted} rehearsal release(s) from ${repo}.`);
}

if (command === "setup") {
  setup();
} else if (command === "teardown") {
  teardown();
} else {
  usage(`unknown command: ${command ?? "(none)"}`);
}
