#!/usr/bin/env python3
"""Export the build to a local repo and create a .flatpak bundle (run from any directory)."""

import argparse
import shutil
from pathlib import Path

from _flatpak_env import ensure_venv, repo_root, run_command


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export the build to a local repo and create a Flatpak bundle."
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
        "--repo",
        default="flatpak-repo",
        help="Local repo directory (default: flatpak-repo)",
    )
    parser.add_argument(
        "--bundle",
        default="com.nexusmods.vortex.flatpak",
        help="Bundle filename (default: com.nexusmods.vortex.flatpak)",
    )
    parser.add_argument(
        "--app-id",
        default="com.nexusmods.vortex",
        help="Flatpak app id (default: com.nexusmods.vortex)",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Do not pass --force-clean when exporting",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)

    if shutil.which("flatpak-builder") is None:
        print("flatpak-builder not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    if shutil.which("flatpak") is None:
        print("flatpak not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    root = repo_root()
    build_dir = Path(args.build_dir)
    manifest = Path(args.manifest)
    repo_dir = Path(args.repo)
    bundle_path = Path(args.bundle)

    if not build_dir.is_absolute():
        build_dir = root / build_dir
    if not manifest.is_absolute():
        manifest = root / manifest
    if not repo_dir.is_absolute():
        repo_dir = root / repo_dir
    if not bundle_path.is_absolute():
        bundle_path = root / bundle_path

    export_cmd = ["flatpak-builder"]
    if not args.no_clean:
        export_cmd.append("--force-clean")
    export_cmd.extend(["--repo", str(repo_dir), str(build_dir), str(manifest)])

    run_command(export_cmd, cwd=root)

    run_command(
        ["flatpak", "build-bundle", str(repo_dir), str(bundle_path), args.app_id],
        cwd=root,
    )


if __name__ == "__main__":
    main()
