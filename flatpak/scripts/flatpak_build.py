#!/usr/bin/env python3
"""Build the Flatpak using flatpak-builder and the repo manifest (run from any directory)."""

import argparse
import shutil
from pathlib import Path

from _flatpak_build_utils import refresh_metadata_in_build
from _flatpak_env import ensure_flathub_remote, ensure_venv, repo_root, run_command
from update_metainfo_version import update_metainfo_version


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
        "--repo",
        default="flatpak/flatpak-repo",
        help="Local repo directory (default: flatpak/flatpak-repo)",
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
        "--refresh-metadata",
        action="store_true",
        help="Update metainfo and re-export without rebuilding",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)

    root = repo_root()
    build_dir = Path(args.build_dir)
    manifest = Path(args.manifest)
    repo_dir = Path(args.repo)
    if not build_dir.is_absolute():
        build_dir = root / build_dir
    if not manifest.is_absolute():
        manifest = root / manifest
    if not repo_dir.is_absolute():
        repo_dir = root / repo_dir

    if shutil.which("flatpak-builder") is None:
        print("flatpak-builder not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    ensure_flathub_remote()

    # Always update metainfo version from package.json
    update_metainfo_version(root)

    if args.refresh_metadata:
        # Update metainfo and re-export
        refresh_metadata_in_build(build_dir, repo_dir)

        print("\nDone! Run the following to install the updated version:")
        print(f"  python flatpak/scripts/flatpak_install.py --skip-build")
        return

    # Full build
    cmd = ["flatpak-builder", "--force-clean"]
    cmd.extend([str(build_dir), str(manifest)])
    if args.install_deps_from:
        cmd.extend(["--install-deps-from", args.install_deps_from])
    if not args.system:
        cmd.append("--user")

    run_command(cmd, cwd=root)


if __name__ == "__main__":
    main()
