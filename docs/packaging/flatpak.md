# Flatpak Packaging

Use this page when you need to build, install, or bundle the Flatpak package.

> [!WARNING]
> Flatpak is broken right now.
> `pnpm` support in Flatpak still needs fixing.

## Flatpak Basics (Linux Packaging)

These dependencies are only required if you are building the Flatpak package.

### Requirements

- `flatpak`
- `flatpak-builder`
- `appstream` for AppStream metadata validation via `appstreamcli`

### Example Installs (Linux)

- Ubuntu or Debian: `sudo apt install flatpak flatpak-builder appstream`
- Fedora: `sudo dnf install flatpak flatpak-builder appstream`
- Arch Linux: `sudo pacman -S flatpak flatpak-builder appstream`
- NixOS: Included in `nix develop` through [Nix flake]

> [!note]
> There is an additional Python-based dependency,
> `flatpak-node-generator`, but the scripts in `flatpak/scripts/`
> automatically install it for you. The Flathub remote is also added
> automatically if missing.

## First-Time Setup

Make sure submodules are available before the first Flatpak build:

```bash
git submodule update --init --recursive
```

## Common Workflows

### Quick Development Test

Build the Flatpak with the standard defaults, then run the installed app:

```bash
python3 flatpak/scripts/flatpak_build.py
python3 flatpak/scripts/flatpak_run.py
```

### Install Into A Local Repo

This builds and installs the app so it appears in software centers such as
KDE Discover or GNOME Software:

```bash
python3 flatpak/scripts/flatpak_install.py
```

If you already built with `flatpak_build.py`, you can skip the rebuild:

```bash
python3 flatpak/scripts/flatpak_install.py --skip-build
```

### Create A Bundle

This builds the package and creates a `.flatpak` bundle for distribution:

```bash
python3 flatpak/scripts/flatpak_bundle.py
```

If you already built with `flatpak_build.py`, you can skip the rebuild:

```bash
python3 flatpak/scripts/flatpak_bundle.py --skip-build
```

## Further Reading

- [Flatpak maintenance] for the full workflow and troubleshooting
- [Flatpak technical notes] for manifest and runtime details
- [Flatpak documentation]

[Flatpak documentation]: https://docs.flatpak.org/en/latest/
[Flatpak maintenance]: ../flatpak/maintenance.md
[Flatpak technical notes]: ../flatpak/technical.md
[Nix flake]: ../../flake.nix
