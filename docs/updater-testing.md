# Testing the Auto-Updater Locally

The full update cycle (resolve, notify, download differentially, verify,
install) can be exercised on one machine with no GitHub access, using
packaged local builds and a mock feed. This is how the updater overhaul was
field-tested; it is also the tool for reproducing user reports (edit a
fixture to match what the user saw and watch what the updater does).

What it can't cover: real signature verification (local builds are unsigned,
see the `publisherName` section), GitHub-specific edges (CDN redirects, rate
limits, prerelease flags), and cross-major "Downgrade detected" startup
warnings. Those need the rehearsal with CI-signed builds against a scratch
GitHub repo, see [updater-rehearsal.md](./updater-rehearsal.md).

## 1. Build two test installers

Updates need two versions. Pick a version far above real releases (e.g.
`9.0.0` and `9.0.1`, a patch delta, so the auto-download path is testable)
and build each from the repo root:

```powershell
pnpm -F "@vortex/main" version 9.0.0 --no-git-tag-version --no-git-checks --allow-same-version
pnpm package:nosign     # root script; the src/main package scripts fail standalone
node scripts/verify-packaged-asar.mjs   # gate: nested dep versions survived packaging
```

Artifacts land in the repo-root `dist/`: `vortex-setup-<v>.exe`, its
`.exe.blockmap` (differential updates), and `latest.yml` (the updater
manifest). Repeat with the second version, then restore the placeholder:
`git restore src/main/package.json`.

If `pnpm package:nosign` dies unexplained right after electron-builder prints
`packaging` (seen in the field: the wrapper chain died with exit 127 while a
direct invocation worked), the equivalent direct path is:

```powershell
$env:NODE_ENV = "production"; pnpm nx run @vortex/main:publish
cd src/main/dist
node node_modules/electron-builder/cli.js --config ./electron-builder.config.json --publish never
```

## 2. Stage the assets

Put the artifacts in a scratch directory the mock feed will serve, e.g.:

```
C:\src\updtest\assets\
  vortex-setup-9.0.0.exe        vortex-setup-9.0.0.exe.blockmap
  vortex-setup-9.0.1.exe        vortex-setup-9.0.1.exe.blockmap
  latest.yml                    # flat fallback (copy of the newest)
  v9.0.0\latest.yml             # per-tag manifests, required: they share a
  v9.0.1\latest.yml             # filename but differ per version
```

Each `latest.yml` must describe its own exe (electron-builder writes one per
build; copy it before building the next version). Both blockmaps are needed
for differential downloads: the old-version blockmap URL is derived from the
running app's version.

## 3. Fixtures

The feed serves a canned GitHub releases listing. Two useful shapes:

- Upgrade (patch flow): `v9.0.1` and `v9.0.0`, both `prerelease: false`.
- Downgrade (offer flow): only `v9.0.0`. A machine running 9.0.1 on the
  stable channel then has an older "latest".

Each release entry needs `tag_name`, `prerelease`, `draft: false`, and an
`assets` list naming the exe and `latest.yml` (the resolver rejects releases
missing them). The unit-test fixture
`src/main/src/extensions/autoupdater/__fixtures__/releases.json` is the
default and shows the full shape.

## 4. Run the mock feed

```powershell
node scripts/mock-update-feed.mjs --port 9877 --fixture C:\src\updtest\releases-blockmap.json --assets C:\src\updtest\assets
```

It serves the releases listing, per-tag `latest.yml`, installers with HTTP
range support (differential downloads work), and blockmaps, logging every
request with what was served and from where. Binds loopback only. A missing
blockmap 404s, which exercises the full-download fallback.

## 5. Point Vortex at it

Two env vars redirect the resolver and the downloads:

- `VORTEX_UPDATER_API_BASE=http://localhost:9877`
- `VORTEX_UPDATER_DOWNLOAD_BASE=http://localhost:9877`

For a packaged build launched from a terminal, per-session works:
`$env:VORTEX_UPDATER_API_BASE = "http://localhost:9877"` (PowerShell; `set`
silently does nothing there). For launches from the Start menu, persist them
user-level:

```powershell
[Environment]::SetEnvironmentVariable("VORTEX_UPDATER_API_BASE", "http://localhost:9877", "User")
[Environment]::SetEnvironmentVariable("VORTEX_UPDATER_DOWNLOAD_BASE", "http://localhost:9877", "User")
```

Clear them (set to `$null`) before using a real Vortex again. A production
build with these set would look for updates on localhost.

For run-from-source (`pnpm start`) there's an opt-in dev updater: set
`VORTEX_DEV_UPDATER=1` and electron-updater reads `src/main/dev-app-update.yml`.
Checks, notifications, and downloads all work; installs are hard-gated to
packaged builds and never run from source.

## 6. The `publisherName` strip (unsigned builds only)

Local builds are unsigned, but the installed `app-update.yml` tells
electron-updater to require a Black Tree Gaming signature, so every download
fails verification ("not signed by the application owner"). For test
installs, delete the `publisherName` block from
`C:\Program Files\Vortex\resources\app-update.yml`:

- Needs an elevated editor/shell (Program Files); an un-elevated save fails
  silently.
- Restart Vortex afterwards; the file is read once per session.
- Re-strip after every updater-driven install; each install rewrites it.

That this fails closed is the signature gate working. Never weaken it in the
config, only in the locally installed copy.

## 7. Between runs

- Delete `%LOCALAPPDATA%\vortex-updater` when switching test builds. The
  pending-installer cache short-circuits downloads (a cached installer with a
  different sha is detected and cleaned automatically, but a matching one is
  reused, which may not be what the test intends).
- Watch `%APPDATA%\Vortex\vortex.log`: every state transition logs as
  `Updater state {from, to}`, and electron-updater's own lines (blockmap
  fetches, ranged downloads, signature verification) are routed there too.

## 8. Test recipes

- Patch flow: install the older build and launch. Expect a silent
  differential download, "Vortex will update on restart", then Restart Now
  (or quit), UAC, the visible installer, and "Vortex was updated to {v}" on
  relaunch.
- Downgrade flow: install/update to the newer build and feed the downgrade
  fixture. Switch the channel away and back to Stable for the offer. Decline
  (gone until the next purposeful switch), re-offer, confirm, visible
  download with percent, staged, survives Check now, Restart Now.
- Failure drills: kill the feed mid-download (error notification, and the
  update returns to downloadable); launch with the feed down (background
  check silent, Check now loud); switch channels mid-download (cancels, no
  error); set the channel to none with an offer showing (withdrawn).
