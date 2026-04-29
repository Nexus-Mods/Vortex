# Flatpak Maintenance

How to build and update the Flatpak package.

> [!WARNING]
>
> ## IMPORTANT: PNPM LOCKFILES ARE NOT SUPPORTED IN FLATPAK-BUILDER-TOOLS YET
>
> Flatpak dependency source generation still relies on compatibility lockfiles
> such as npm and Yarn, not `pnpm-lock.yaml`.
>
> - [Flatpak Builder Tools PR 511]
> - [Flatpak Builder Tools issue 383]

> [!note] Prerequisites
> See [Flatpak packaging] for the basics and
> first-time setup.

## Helper Scripts

Scripts in `flatpak/scripts/` automate common tasks. They manage their own
virtual environment and can run from any directory.

> [!tip]
> Use `python` instead if `python3` does not work on your system.

### Development Workflow

- `flatpak_build.py`: build the Flatpak with standard defaults
- `flatpak_run.py`: run the installed Flatpak, building and installing first
  if needed

### Distribution And UX Testing Workflow

- `flatpak_install.py`: export to a local repo and install the app so it
  appears in KDE Discover and similar software centers
- `flatpak_bundle.py`: export to a local repo and create a `.flatpak` bundle

## Typical Workflows

### First-time Setup

First ensure your submodules are up to date:

```bash
git submodule update --init --recursive
```

### Development Iteration

**Quick test (fastest, no install):**

```bash
python3 flatpak/scripts/flatpak_build.py
python3 flatpak/scripts/flatpak_run.py
```

**UX testing (appears in Discover, GNOME Software):**

Builds and installs the app (it will appear in software centers like KDE Discover):

```bash
python3 flatpak/scripts/flatpak_install.py
# Optionally run immediately: python3 flatpak/scripts/flatpak_install.py --run
```

If you already built with `flatpak_build.py`, use `--skip-build` to avoid rebuilding:

```bash
python3 flatpak/scripts/flatpak_install.py --skip-build
```

### Creating a Bundle

Builds and creates a `.flatpak` bundle file for publishing:

```bash
python3 flatpak/scripts/flatpak_bundle.py
```

If you already built with `flatpak_build.py`, use `--skip-build` to avoid rebuilding:

```bash
python3 flatpak/scripts/flatpak_bundle.py --skip-build
```

### Workflow Notes

- `flatpak_run.py` ensures the app is installed, then runs it
- `flatpak_install.py --skip-build` re-exports from an existing build without
  rebuilding
- `flatpak_bundle.py` creates a `.flatpak` file for distribution
- `nxm://` protocol switching should work out of the box. Whichever Vortex
  build you launched last should become the active handler

## Script Differences

- **`flatpak_run.py`**: development testing with proper single-instance
  support. It installs the app if needed so protocol handlers work correctly,
  then runs the installed version
- **`flatpak_install.py`**: UX testing. It installs the app properly so it
  appears in software centers and creates a local OSTree repo at
  `flatpak/flatpak-repo/` which is gitignored

## Runtime Updates

Update `runtime-version`, `base-version`, and SDK extensions together to maintain ABI compatibility.

Current baselines:

- Runtime: `org.freedesktop.Platform` 25.08
- BaseApp: `org.electronjs.Electron2.BaseApp` 25.08
- Node SDK: `org.freedesktop.Sdk.Extension.node22`
- .NET SDK: `org.freedesktop.Sdk.Extension.dotnet9`

## generated-sources.json, generated-nuget-sources.json & Offline Build Behaviour

Flatpak builds run in offline mode inside the build sandbox.

- `flatpak-builder` downloads sources up front:
    - npm packages in `flatpak/generated-sources.json`
    - NuGet packages in `flatpak/generated-nuget-sources.json`
- build commands then run offline in the sandbox using those prefetched sources

This is required for _Flathub submission_ and ensures reproducible builds.

To keep source files in sync automatically, build scripts now:

- hash recursive repository `yarn.lock` files and compare against
  `flatpak/generated-sources.hash`
- hash FOMOD `.csproj` and NuGet input files and compare against
  `flatpak/generated-nuget-sources.hash`
- regenerate each generated source file only when needed

To sync both generated source files manually, run:

```bash
python3 flatpak/scripts/flatpak_sources.py
```

If you are debugging `generated-sources.json` generation, you can run the sync script manually:

```bash
python3 flatpak/scripts/flatpak_sources.py --only yarn --force
```

If you are debugging `generated-nuget-sources.json` generation, run:

```bash
python3 flatpak/scripts/flatpak_sources.py --only nuget --force
```

NuGet source syncing scans `extensions/` by default. Use `--search-root` if
you need to narrow the scope during debugging.

## Troubleshooting

- Missing submodule files during Flatpak build: `yarn install` normally runs
  `preinstall.js`, which initializes submodules. If you have not run
  `yarn install` locally, run `git submodule update --init --recursive`
  first
- `nxm://` handler did not switch automatically:

```bash
# Check current handler on host
xdg-settings get default-url-scheme-handler nxm

# Force Flatpak build as handler
xdg-settings set default-url-scheme-handler nxm com.nexusmods.vortex.desktop

# Force development build as handler
xdg-settings set default-url-scheme-handler nxm com.nexusmods.vortex.dev.desktop
```

## References

- [Flatpak Electron guide]
- [Flatpak .NET guide]
- [flatpak-builder documentation]

[Flatpak packaging]: ../packaging/flatpak.md
[Flatpak builder tools issue 383]: https://github.com/flatpak/flatpak-builder-tools/issues/383
[Flatpak Builder Tools PR 511]: https://github.com/flatpak/flatpak-builder-tools/pull/511
[Flatpak .NET guide]: https://docs.flatpak.org/en/latest/dotnet.html
[Flatpak Electron guide]: https://docs.flatpak.org/en/latest/electron.html
[flatpak-builder documentation]: https://docs.flatpak.org/en/latest/flatpak-builder.html
