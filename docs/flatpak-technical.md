# Flatpak Technical Details

Technical notes for developers working on the Flatpak build.

## Build Pipeline

Offline-first: `flatpak-node-generator` converts Yarn lockfiles into `generated-sources.json` so builds need no network. Yarn pulls from an offline mirror inside the sandbox.

Build stages (in the SDK sandbox):

1. `yarn install` -- offline dependency fetch
2. `_install_app`, `subprojects_app`, `_assets_app`, `build_dist` -- compile to `app/`
3. Copy `app/` to `/app/main`
4. `dotnet-runtime` module -- stage .NET runtime

See `flatpak/com.nexusmods.vortex.yaml` for per-phase commands and environment variables.

## Yarn Config (`flatpak/yarnrc`)

- `child-concurrency 1` -- deterministic, avoids cache races
- `yarn-offline-mirror` -- tarball store inside the sandbox
- `yarn-offline-mirror-pruning false` -- don't delete needed tarballs
- `cache-folder` -- writable cache in the sandbox

## Launch Mechanism

`flatpak/run.sh` launches with `zypak-wrapper /app/bin/electron /app/main`.

- Zypak runs Electron inside the sandbox (see [Zypak docs](https://github.com/refi64/zypak))
- Desktop file points to `run.sh`
- Entrypoint must use Zypak per Flatpak Electron guidance

## Why These Choices

**Full host filesystem access**: Game installs can be anywhere. Deployment uses hardlinks/symlinks/moves. Portals are not viable because scanning and deployment are background operations that cannot wait for user-mediated prompts.

**Offline builds**: Required for Flathub and reproducible builds. All Yarn/NPM dependencies must be in `generated-sources.json`.

**Zypak wrapper**: Required by the Electron BaseApp to run Chromium's sandbox inside Flatpak's sandbox.

**.NET runtime staging**: Framework-dependent tools (like `dotnetprobe`) need `DOTNET_ROOT` pointing to the staged runtime at `/app/lib/dotnet`.
