#!/usr/bin/env python3
"""Build the Flatpak using flatpak-builder and the repo manifest (run from any directory)."""

import argparse
import shutil
from pathlib import Path

from _flatpak_env import ensure_flathub_remote, ensure_venv, repo_root, run_command


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the Vortex Flatpak using flatpak-builder."
    )
    parser.add_argument(
        "--build-dir",
        default="build-flatpak",
        help="Build output directory (default: build-flatpak)",
    )
    parser.add_argument(
        "--manifest",
        default="flatpak/com.nexusmods.vortex.yaml",
        help="Flatpak manifest path (default: flatpak/com.nexusmods.vortex.yaml)",
    )
    parser.add_argument(
        "--install-deps-from",
        default="flathub",
        help="Remote for runtime deps (default: flathub)",
    )
    parser.add_argument(
        "--system",
        action="store_true",
        help="Install dependencies system-wide (default: --user)",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Do not pass --force-clean",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)

    if shutil.which("flatpak-builder") is None:
        print("flatpak-builder not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    ensure_flathub_remote()

    root = repo_root()
    build_dir = Path(args.build_dir)
    manifest = Path(args.manifest)
    if not build_dir.is_absolute():
        build_dir = root / build_dir
    if not manifest.is_absolute():
        manifest = root / manifest

    cmd = ["flatpak-builder"]
    if not args.no_clean:
        cmd.append("--force-clean")
    cmd.extend([str(build_dir), str(manifest)])
    if args.install_deps_from:
        cmd.extend(["--install-deps-from", args.install_deps_from])
    if not args.system:
        cmd.append("--user")

    run_command(cmd, cwd=root)


if __name__ == "__main__":
    main()
