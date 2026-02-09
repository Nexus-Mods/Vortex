#!/usr/bin/env python3
"""Generate flatpak/generated-sources.json from yarn.lock files (run from any directory)."""

import argparse
from pathlib import Path

from _flatpak_env import ensure_venv, repo_root, run_command


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate flatpak/generated-sources.json from yarn.lock files."
    )
    parser.add_argument(
        "--lockfile",
        default="yarn.lock",
        help="Path to the root yarn.lock (default: yarn.lock)",
    )
    parser.add_argument(
        "--output",
        default="flatpak/generated-sources.json",
        help="Output JSON file (default: flatpak/generated-sources.json)",
    )
    parser.add_argument(
        "--no-recursive",
        action="store_false",
        dest="recursive",
        help="Disable recursive lockfile scanning",
    )
    parser.set_defaults(recursive=True)
    args = parser.parse_args()

    info = ensure_venv(install_packages=True)

    root = repo_root()
    lockfile = Path(args.lockfile)
    output = Path(args.output)
    if not lockfile.is_absolute():
        lockfile = root / lockfile
    if not output.is_absolute():
        output = root / output

    cmd = [
        str(info.flatpak_node_generator),
        "yarn",
        str(lockfile),
        "-o",
        str(output),
    ]
    if args.recursive:
        cmd.append("-r")

    run_command(cmd, cwd=root)


if __name__ == "__main__":
    main()
