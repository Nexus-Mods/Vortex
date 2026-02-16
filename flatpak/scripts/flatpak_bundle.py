#!/usr/bin/env python3
"""Export the build to a local repo and create a .flatpak bundle (run from any directory)."""

import argparse
from pathlib import Path

from _flatpak_env import ensure_flathub_remote, ensure_venv, run_command
from _flatpak_workflow import (
    ensure_flatpak_tools,
    export_build_to_repo,
    resolve_flatpak_paths,
    run_flatpak_builder,
    sync_flatpak_build_inputs,
)


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
        default="flatpak/flatpak-repo",
        help="Local repo directory (default: flatpak/flatpak-repo)",
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
        "--skip-build",
        action="store_true",
        help="Export from existing build without rebuilding",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)
    ensure_flatpak_tools()

    ensure_flathub_remote()

    paths = resolve_flatpak_paths(args.build_dir, args.manifest, args.repo)
    bundle_path = Path(args.bundle)

    if not bundle_path.is_absolute():
        bundle_path = paths.root / bundle_path

    if args.skip_build:
        # Export existing build without rebuilding
        print(f"Exporting from existing build...")
        if not paths.build_dir.exists():
            print(f"Error: Build directory {paths.build_dir} does not exist.")
            print("Run without --skip-build to perform initial build.")
            raise SystemExit(1)

        print(f"Re-exporting to {paths.repo_dir}...")
        export_build_to_repo(
            root=paths.root,
            repo_dir=paths.repo_dir,
            build_dir=paths.build_dir,
            update_appstream=False,
        )
    else:
        # Use flatpak-builder to build and export
        sync_flatpak_build_inputs(paths.root)

        print(f"Building and exporting to local repo...")
        run_flatpak_builder(
            root=paths.root,
            build_dir=paths.build_dir,
            manifest=paths.manifest,
            repo_dir=paths.repo_dir,
        )

    run_command(
        [
            "flatpak",
            "build-bundle",
            str(paths.repo_dir),
            str(bundle_path),
            args.app_id,
        ],
        cwd=paths.root,
    )


if __name__ == "__main__":
    main()
