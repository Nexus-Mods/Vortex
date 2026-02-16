# Flatpak Maintenance

How to build and update the Flatpak package.

> [!note] Prerequisites
> See [Flatpak basics in CONTRIBUTE.md](../CONTRIBUTE.md#flatpak-basics-linux-packaging).

## Helper Scripts

Scripts in `flatpak/scripts/` automate common tasks. They manage their own virtual environment and can run from any directory.

> [!tip]
> Use `python` instead if `python3` does not work on your system.

### Development workflow

| Script             | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| `flatpak_build.py` | Build the Flatpak with standard defaults                        |
| `flatpak_run.py`   | Run the installed Flatpak (builds and installs first if needed) |

### Distribution/UX Testing workflow

| Script               | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `flatpak_install.py` | Export to a local repo, install the app (appears in KDE Discover, etc.) |
| `flatpak_bundle.py`  | Export to a local repo and create a `.flatpak` bundle                   |

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

- `flatpak_run.py` ensures the app is installed (builds and installs if needed), then runs it
- `flatpak_install.py --skip-build` re-exports from existing build without rebuilding
- `flatpak_bundle.py` creates a `.flatpak` file for distribution
- `nxm://` protocol switching should work out of the box: whichever Vortex build you launched last should become the active handler

## Script Differences

- **`flatpak_run.py`**: Development testing with proper single-instance support. Installs the app if needed (so protocol handlers work correctly), then runs the installed version.
- **`flatpak_install.py`**: UX testing. Installs the app properly so it appears in software centers. Creates a local OSTree repo at `flatpak/flatpak-repo/` (gitignored).

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

- hash recursive repository `yarn.lock` files and compare against `flatpak/generated-sources.hash`
- hash FOMOD `.csproj`/NuGet input files and compare against `flatpak/generated-nuget-sources.hash`
- regenerate each generated source file only when needed

If you are debugging `generated-sources.json` generation, you can run the sync script manually:

```bash
python3 flatpak/scripts/flatpak_sources.py --force
```

If you are debugging `generated-nuget-sources.json` generation, run:

```bash
python3 flatpak/scripts/flatpak_nuget_sources.py --force
```

## Troubleshooting

- Missing submodule files during Flatpak build: `yarn install` normally runs `preinstall.js`, which initializes submodules. If you have not run `yarn install` locally, run `git submodule update --init --recursive` first.
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

- [Flatpak Electron guide](https://docs.flatpak.org/en/latest/electron.html)
- [Flatpak .NET guide](https://docs.flatpak.org/en/latest/dotnet.html)
- [flatpak-builder documentation](https://docs.flatpak.org/en/latest/flatpak-builder.html)
