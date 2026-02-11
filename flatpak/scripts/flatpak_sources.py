#!/usr/bin/env python3
"""Generate and sync flatpak/generated-sources.json from yarn.lock files."""

import argparse
from pathlib import Path

from _flatpak_sources_hash import (
    compute_sources_hash,
    read_stored_hash,
    write_stored_hash,
)
from _flatpak_env import ensure_venv, repo_root, run_command


def generate_sources(lockfile: Path, output: Path, recursive: bool) -> None:
    info = ensure_venv(install_packages=True)

    root = repo_root()

    cmd = [
        str(info.flatpak_node_generator),
        "yarn",
        str(lockfile),
        "-o",
        str(output),
    ]
    if recursive:
        cmd.append("-r")

    run_command(cmd, cwd=root)


def sync_generated_sources(
    lockfile: Path,
    output: Path,
    hash_file: Path,
    recursive: bool = True,
    force: bool = False,
) -> bool:
    root = repo_root()
    if not lockfile.is_absolute():
        lockfile = root / lockfile
    if not output.is_absolute():
        output = root / output
    if not hash_file.is_absolute():
        hash_file = root / hash_file

    source_hash, _ = compute_sources_hash(lockfile=lockfile, recursive=recursive)
    stored_hash = read_stored_hash(hash_file)

    if not force and output.exists() and stored_hash == source_hash:
        print("Flatpak generated sources are up to date (hash match).")
        return False

    if force:
        print("Regenerating flatpak sources (forced by --force).")
    elif not output.exists():
        print(f"Regenerating flatpak sources (missing output: {output}).")
    elif stored_hash is None:
        print(f"Regenerating flatpak sources (missing hash file: {hash_file}).")
    else:
        print("Regenerating flatpak sources (lockfile hash changed).")

    generate_sources(lockfile=lockfile, output=output, recursive=recursive)
    write_stored_hash(hash_file=hash_file, value=source_hash)
    print(f"Updated Flatpak sources hash: {hash_file}")
    return True


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
        "--hash-file",
        default="flatpak/generated-sources.hash",
        help="Stored lockfile hash file (default: flatpak/generated-sources.hash)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Always regenerate and refresh hash, even when hashes match",
    )
    parser.add_argument(
        "--no-recursive",
        action="store_false",
        dest="recursive",
        help="Disable recursive lockfile scanning",
    )
    parser.set_defaults(recursive=True)
    args = parser.parse_args()

    root = repo_root()
    lockfile = Path(args.lockfile)
    output = Path(args.output)
    hash_file = Path(args.hash_file)
    if not lockfile.is_absolute():
        lockfile = root / lockfile
    if not output.is_absolute():
        output = root / output
    if not hash_file.is_absolute():
        hash_file = root / hash_file

    sync_generated_sources(
        lockfile=lockfile,
        output=output,
        hash_file=hash_file,
        recursive=args.recursive,
        force=args.force,
    )


if __name__ == "__main__":
    main()
