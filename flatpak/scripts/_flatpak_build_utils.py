#!/usr/bin/env python3
"""Internal utilities for Flatpak build operations (not a standalone script)."""

import shutil
from pathlib import Path
from typing import Optional


def refresh_metadata_in_build(
    build_dir: Path, repo_dir: Optional[Path] = None, root: Optional[Path] = None
) -> None:
    """Update metainfo in build directory and optionally re-export to repo.

    Args:
        build_dir: Path to the flatpak build directory
        repo_dir: Optional path to the OSTree repo for re-export
        root: Optional repo root path (auto-detected if not provided)
    """
    from _flatpak_env import repo_root, run_command
    from update_metainfo_version import update_metainfo_version

    if root is None:
        root = repo_root()

    # Update metainfo version from package.json
    update_metainfo_version(root)

    metainfo_source = root / "flatpak" / "com.nexusmods.vortex.metainfo.xml"
    metainfo_dest = (
        build_dir / "files" / "share" / "metainfo" / "com.nexusmods.vortex.metainfo.xml"
    )
    export_metainfo_dest = (
        build_dir
        / "export"
        / "share"
        / "metainfo"
        / "com.nexusmods.vortex.metainfo.xml"
    )

    if not build_dir.exists():
        print(f"Error: Build directory does not exist at {build_dir}")
        print("Run without --refresh-metadata to perform initial build.")
        raise SystemExit(1)

    print(f"Updating metainfo in {build_dir}...")

    if metainfo_dest.exists():
        shutil.copy2(metainfo_source, metainfo_dest)
        print(f"  Updated {metainfo_dest}")
    else:
        print(f"  Warning: {metainfo_dest} not found")

    if export_metainfo_dest.exists():
        shutil.copy2(metainfo_source, export_metainfo_dest)
        print(f"  Updated {export_metainfo_dest}")

    if repo_dir:
        print(f"\nRe-exporting to {repo_dir}...")
        export_cmd = ["flatpak", "build-export", str(repo_dir), str(build_dir)]
        run_command(export_cmd, cwd=root)
