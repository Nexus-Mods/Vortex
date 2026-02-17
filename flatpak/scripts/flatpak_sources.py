#!/usr/bin/env python3
"""Generate and sync Flatpak source manifests for yarn and NuGet inputs."""

import argparse
from pathlib import Path
from typing import Iterable, List, Optional

from _flatpak_env import ensure_venv, repo_root, run_command
from _flatpak_nuget_hash import (
    collect_nuget_input_files,
    compute_nuget_sources_hash,
    read_stored_hash as read_nuget_stored_hash,
    write_stored_hash as write_nuget_stored_hash,
)
from _flatpak_yarn_hash import (
    collect_lockfiles,
    compute_sources_hash,
    read_stored_hash as read_sources_stored_hash,
    write_stored_hash as write_sources_stored_hash,
)


DEFAULT_LOCKFILE = "yarn.lock"
DEFAULT_YARN_OUTPUT = "flatpak/generated-sources.json"
DEFAULT_YARN_HASH_FILE = "flatpak/generated-sources.hash"
DEFAULT_NUGET_SEARCH_ROOT = "extensions"
DEFAULT_NUGET_OUTPUT = "flatpak/generated-nuget-sources.json"
DEFAULT_NUGET_HASH_FILE = "flatpak/generated-nuget-sources.hash"
DEFAULT_DOTNET = "9"
DEFAULT_FREEDESKTOP = "25.08"
DEFAULT_DESTDIR = "flatpak-nuget-sources"
DEFAULT_RUNTIME = "linux-x64"


def generate_sources(
    lockfile: Path,
    output: Path,
    recursive: bool,
    lockfiles: Optional[List[Path]] = None,
) -> None:
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
        if lockfiles is None:
            lockfiles = collect_lockfiles(lockfile=lockfile, recursive=True)
        cmd.append("-r")
        for lockfile_path in lockfiles:
            cmd.extend(["-R", str(lockfile_path)])

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

    source_hash, lockfiles = compute_sources_hash(
        lockfile=lockfile, recursive=recursive
    )
    stored_hash = read_sources_stored_hash(hash_file)

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

    generate_sources(
        lockfile=lockfile,
        output=output,
        recursive=recursive,
        lockfiles=lockfiles,
    )
    write_sources_stored_hash(hash_file=hash_file, value=source_hash)
    print(f"Updated Flatpak sources hash: {hash_file}")
    return True


def _resolve_paths(paths: Iterable[Path], root: Path) -> List[Path]:
    resolved: List[Path] = []
    for path in paths:
        resolved.append(path if path.is_absolute() else root / path)
    return resolved


def _discover_nuget_projects(search_root: Path) -> List[Path]:
    projects = [
        path
        for path in collect_nuget_input_files(search_root=search_root)
        if path.suffix.lower() == ".csproj"
    ]
    if not projects:
        raise FileNotFoundError(f"No .csproj files found under: {search_root}")
    return projects


def generate_nuget_sources(
    projects: List[Path],
    output: Path,
    dotnet: str,
    freedesktop: str,
    destdir: str,
    runtime: str,
) -> None:
    info = ensure_venv(install_packages=True)
    root = repo_root()

    cmd = [
        str(info.python_exe),
        str(info.flatpak_dotnet_generator),
        "--dotnet",
        dotnet,
        "--freedesktop",
        freedesktop,
        "--destdir",
        destdir,
        str(output),
        *[str(project) for project in projects],
        "--runtime",
        runtime,
    ]

    run_command(cmd, cwd=root)


def sync_generated_nuget_sources(
    search_root: Path,
    projects: Optional[List[Path]],
    output: Path,
    hash_file: Path,
    dotnet: str,
    freedesktop: str,
    destdir: str,
    runtime: str,
    force: bool = False,
) -> bool:
    root = repo_root()
    if not search_root.is_absolute():
        search_root = root / search_root
    if not output.is_absolute():
        output = root / output
    if not hash_file.is_absolute():
        hash_file = root / hash_file

    if projects:
        projects = _resolve_paths(projects, root)
    else:
        projects = _discover_nuget_projects(search_root)

    for project in projects:
        if not project.exists():
            raise FileNotFoundError(f"NuGet project not found: {project}")

    source_hash, _ = compute_nuget_sources_hash(search_root=search_root)
    stored_hash = read_nuget_stored_hash(hash_file)

    if not force and output.exists() and stored_hash == source_hash:
        print("Flatpak NuGet sources are up to date (hash match).")
        return False

    if force:
        print("Regenerating Flatpak NuGet sources (forced by --force).")
    elif not output.exists():
        print(f"Regenerating Flatpak NuGet sources (missing output: {output}).")
    elif stored_hash is None:
        print(f"Regenerating Flatpak NuGet sources (missing hash file: {hash_file}).")
    else:
        print("Regenerating Flatpak NuGet sources (project hash changed).")

    generate_nuget_sources(
        projects=projects,
        output=output,
        dotnet=dotnet,
        freedesktop=freedesktop,
        destdir=destdir,
        runtime=runtime,
    )
    write_nuget_stored_hash(hash_file=hash_file, value=source_hash)
    print(f"Updated Flatpak NuGet sources hash: {hash_file}")
    return True


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate Flatpak source manifests. "
            "By default this updates both generated-sources.json and "
            "generated-nuget-sources.json."
        )
    )

    parser.add_argument(
        "--only",
        choices=("all", "yarn", "nuget"),
        default="all",
        help="Select which source types to sync (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Always regenerate selected source files, even when hashes match",
    )

    nuget_group = parser.add_argument_group("nuget options")
    nuget_group.add_argument(
        "--search-root",
        default=DEFAULT_NUGET_SEARCH_ROOT,
        help="Root directory to scan for NuGet dependency changes (default: extensions)",
    )
    nuget_group.add_argument(
        "--project",
        action="append",
        default=[],
        help=(
            "Project file path (repeat for multiple projects). "
            "If omitted, all .csproj files under --search-root are used"
        ),
    )

    return parser


def main() -> None:
    args = _build_parser().parse_args()

    run_yarn = args.only in {"all", "yarn"}
    run_nuget = args.only in {"all", "nuget"}

    if run_yarn:
        sync_generated_sources(
            lockfile=Path(DEFAULT_LOCKFILE),
            output=Path(DEFAULT_YARN_OUTPUT),
            hash_file=Path(DEFAULT_YARN_HASH_FILE),
            recursive=True,
            force=args.force,
        )

    if run_nuget:
        projects = [Path(project) for project in args.project] if args.project else None

        sync_generated_nuget_sources(
            search_root=Path(args.search_root),
            projects=projects,
            output=Path(DEFAULT_NUGET_OUTPUT),
            hash_file=Path(DEFAULT_NUGET_HASH_FILE),
            dotnet=DEFAULT_DOTNET,
            freedesktop=DEFAULT_FREEDESKTOP,
            destdir=DEFAULT_DESTDIR,
            runtime=DEFAULT_RUNTIME,
            force=args.force,
        )


if __name__ == "__main__":
    main()
