# Flatpak Maintenance

How to build and update the Flatpak package.

> [!note] Prerequisites
> See [Flatpak basics in CONTRIBUTE.md](../CONTRIBUTE.md#flatpak-basics-linux-packaging).

## Helper Scripts

Scripts in `flatpak/scripts/` automate common tasks. They manage their own virtual environment and can run from any directory.

> [!tip]
> Use `python` instead if `python3` does not work on your system.

### Development workflow

| Script               | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `flatpak_sources.py` | Regenerate `flatpak/generated-sources.json` from lockfiles |
| `flatpak_build.py`   | Build the Flatpak with standard defaults                   |
| `flatpak_run.py`     | Run the build output directly with `flatpak-builder --run` |

### Distribution/UX Testing workflow

| Script               | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `flatpak_install.py` | Export to a local repo, install the app (appears in KDE Discover, etc.) |
| `flatpak_bundle.py`  | Export to a local repo and create a `.flatpak` bundle                   |

## Typical Workflows

### First-time Setup

**Initialize git submodules:**

Flatpak builds run offline and cannot fetch submodules during the build. The manifest sets `VORTEX_SKIP_SUBMODULES=1` to skip the automatic submodule update in `preinstall.js`. Initialize submodules before building:

```bash
git submodule update --init --recursive
```

**Regenerate sources** (whenever `yarn.lock` changes):

```bash
python3 flatpak/scripts/flatpak_sources.py
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

- `flatpak_run.py` always uses the existing build—no export or install step
- `flatpak_install.py --skip-build` re-exports from existing build without rebuilding
- `flatpak_bundle.py` creates a `.flatpak` file for distribution

## Script Differences

- **`flatpak_run.py`**: Quick development testing. Runs directly via `flatpak-builder --run`. Fastest for iterative development.
- **`flatpak_install.py`**: UX testing. Installs the app properly so it appears in software centers. Creates a local OSTree repo at `flatpak/flatpak-repo/` (gitignored).

## Runtime Updates

Update `runtime-version`, `base-version`, and SDK extensions together to maintain ABI compatibility.

Current baselines:

- Runtime: `org.freedesktop.Platform` 25.08
- BaseApp: `org.electronjs.Electron2.BaseApp` 25.08
- Node SDK: `org.freedesktop.Sdk.Extension.node22`
- .NET SDK: `org.freedesktop.Sdk.Extension.dotnet9`

## References

- [Flatpak Electron guide](https://docs.flatpak.org/en/latest/electron.html)
- [Flatpak .NET guide](https://docs.flatpak.org/en/latest/dotnet.html)
- [flatpak-builder documentation](https://docs.flatpak.org/en/latest/flatpak-builder.html)
