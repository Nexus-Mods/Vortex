# Arch Linux Packaging

How to build and install a pacman package of Vortex from a local checkout on
Arch-based distributions, and why the package launches Vortex the way it does.

## Requirements

Complete the [Arch Linux setup] and the [Shared Setup] first. `makepkg` comes
with `base-devel`, which the Arch setup installs.

## Build and Install

From the repo root:

```bash
cd archlinux
makepkg -si
```

`makepkg` builds the checkout that `archlinux/` sits in, not a fresh clone. It
runs `pnpm install`, rebuilds native modules for Electron, builds and deploys
the app through `pnpm nx run @vortex/main:publish`, and packages it with
electron-builder's `dir` target into the repo-root `dist/linux-unpacked/`. The
package lands in `archlinux/` and `-i` installs it. Expect the build to take
several minutes.

The package installs the app to `/opt/vortex`, a launcher to `/usr/bin/vortex`
and a desktop entry to
`/usr/share/applications/com.nexusmods.vortex.desktop`.

## Versions

`src/main/package.json` only holds the placeholder `1.0.0` (see
[Windows packaging]), so the PKGBUILD takes the version from the newest
numbered entry in `CHANGELOG.md`, which every release adds to `master`. It
passes that version to electron-builder as well, so the running app reports
the same version as the package. Nothing in the checkout is modified.

pacman versions can't contain `-`, so `2.9.0-beta.4` is packaged as
`2.9.0beta.4`. pacman still sorts that before `2.9.0`.

## nxm:// Links

The desktop entry registers `x-scheme-handler/nxm` and runs the launcher with
the link as its argument.

- The launcher adds `--download` when it is given an argument. Vortex only
  starts a download for a URL passed as `--download <url>`, and desktop entries
  pass the link on its own. Windows registers the handler with `-d` for the
  same reason, and the Flatpak's `flatpak/run.sh` does the same thing.
- The desktop entry is named `com.nexusmods.vortex.desktop` because that is
  the id Vortex registers as the default `nxm` handler when it starts
  (`src/renderer/src/util/protocolRegistration/linux/nxm.ts`). Under any other
  name, that registration points `nxm` links at a desktop entry that does not
  exist.

Vortex registers the handler with `xdg-settings`. On KDE Plasma that needs
`qtpaths` on `PATH`, which comes from `qt5-tools`; without it registration
fails with `qtpaths: command not found` in the log. To set the handler by hand:

```bash
xdg-mime default com.nexusmods.vortex.desktop x-scheme-handler/nxm
```

## Updates

The launcher sets `IGNORE_UPDATES=yes`, which stops Vortex checking for updates
on its own (`src/main/src/extensions/autoupdater/index.ts`). pacman owns the
installed files, so updates come from rebuilding the package.

## Key Files

- `archlinux/PKGBUILD` - Builds the checkout and lays out the package
- `archlinux/vortex.sh` - Launcher installed as `/usr/bin/vortex`
- `archlinux/com.nexusmods.vortex.desktop` - Desktop entry and `nxm` handler

[Arch Linux setup]: ../install-instructions/archlinux.md
[Shared Setup]: ../install-instructions/shared.md
[Windows packaging]: windows.md#local-unsigned-packages
