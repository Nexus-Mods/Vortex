#!/usr/bin/env python3
"""Update the metainfo.xml version from package.json."""

import json
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path


def get_version_from_package_json(repo_root: Path) -> str:
    """Extract version from package.json."""
    package_json = repo_root / "package.json"
    with open(package_json, "r") as f:
        data = json.load(f)
    return data.get("version", "0.0.1")


def update_metainfo_version(repo_root: Path) -> None:
    """Update the version and release date in metainfo.xml."""
    metainfo_path = repo_root / "flatpak" / "com.nexusmods.vortex.metainfo.xml"

    if not metainfo_path.exists():
        print(f"Warning: {metainfo_path} not found")
        return

    version = get_version_from_package_json(repo_root)
    today = datetime.now().strftime("%Y-%m-%d")

    # Parse the XML
    tree = ET.parse(metainfo_path)
    root = tree.getroot()

    # Define namespace
    ns = {"": root.tag.split("}")[0].strip("{")} if "}" in root.tag else {}

    # Find or create releases section
    releases = root.find("releases", ns)
    if releases is None:
        releases = ET.SubElement(root, "releases")

    # Clear existing releases and add new one
    releases.clear()
    release = ET.SubElement(releases, "release")
    release.set("version", version)
    release.set("date", today)

    description = ET.SubElement(release, "description")
    p = ET.SubElement(description, "p")
    p.text = f"Vortex {version} development build"

    # Write back with proper formatting
    tree.write(metainfo_path, encoding="UTF-8", xml_declaration=True)

    # Re-format the XML to match the original style (pretty print)
    import xml.dom.minidom as minidom

    with open(metainfo_path, "r") as f:
        xml_content = f.read()

    # Parse and pretty print
    dom = minidom.parseString(xml_content)
    pretty_xml = dom.toprettyxml(indent="  ")

    # Remove extra blank lines
    lines = [line for line in pretty_xml.split("\n") if line.strip()]
    pretty_xml = "\n".join(lines)

    # Ensure there's a newline at the end
    pretty_xml += "\n"

    with open(metainfo_path, "w") as f:
        f.write(pretty_xml)

    print(f"Updated {metainfo_path} with version {version}")


def main():
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parents[1]
    update_metainfo_version(repo_root)


if __name__ == "__main__":
    main()
