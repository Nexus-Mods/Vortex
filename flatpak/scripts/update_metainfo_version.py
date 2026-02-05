#!/usr/bin/env python3
"""Update the metainfo.xml version from package.json using string replacement."""

import json
import re
from datetime import datetime
from pathlib import Path


def get_version_from_package_json(repo_root: Path) -> str:
    """Extract version from app/package.json (release version)."""
    package_json = repo_root / "app" / "package.json"
    if not package_json.exists():
        # Fall back to root package.json for development
        package_json = repo_root / "package.json"
    with open(package_json, "r") as f:
        data = json.load(f)
    return data.get("version", "0.0.1")


def update_metainfo_version(repo_root: Path) -> None:
    """Update the version and release date in metainfo.xml using regex."""
    metainfo_path = repo_root / "flatpak" / "com.nexusmods.vortex.metainfo.xml"

    if not metainfo_path.exists():
        print(f"Warning: {metainfo_path} not found")
        return

    version = get_version_from_package_json(repo_root)
    today = datetime.now().strftime("%Y-%m-%d")

    with open(metainfo_path, "r") as f:
        content = f.read()

    # Update version in existing release tag
    version_pattern = r'(<release\s+version=")([^"]+)("\s+date=")([^"]+)(")'
    if re.search(version_pattern, content):
        content = re.sub(version_pattern, rf"\g<1>{version}\g<3>{today}\g<5>", content)
        print(f"Updated {metainfo_path} with version {version}")
    else:
        # No release tag found, don't modify
        print(
            f"Warning: No release tag found in {metainfo_path}, skipping version update"
        )

    with open(metainfo_path, "w") as f:
        f.write(content)


def main():
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parents[1]
    update_metainfo_version(repo_root)


if __name__ == "__main__":
    main()
