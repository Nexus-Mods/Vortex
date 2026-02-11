#!/usr/bin/env python3
"""Generate and sync Flatpak NuGet sources for offline .NET builds."""

import argparse
from pathlib import Path
from typing import Iterable, List

from _flatpak_env import ensure_venv, repo_root, run_command
from _flatpak_nuget_hash import (
    compute_nuget_sources_hash,
    read_stored_hash,
    write_stored_hash,
)


def _resolve_paths(paths: Iterable[Path], root: Path) -> List[Path]:
    resolved: List[Path] = []
    for path in paths:
        resolved.append(path if path.is_absolute() else root / path)
    return resolved


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
    projects: List[Path],
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
    projects = _resolve_paths(projects, root)

    for project in projects:
        if not project.exists():
            raise FileNotFoundError(f"NuGet project not found: {project}")

    source_hash, _ = compute_nuget_sources_hash(search_root=search_root)
    stored_hash = read_stored_hash(hash_file)

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
    write_stored_hash(hash_file=hash_file, value=source_hash)
    print(f"Updated Flatpak NuGet sources hash: {hash_file}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate flatpak/generated-nuget-sources.json from .NET project files."
    )
    parser.add_argument(
        "--search-root",
        default="extensions/fomod-installer",
        help="Root directory to hash for NuGet dependency changes",
    )
    parser.add_argument(
        "--project",
        action="append",
        default=[],
        help="Project file path (repeat for multiple projects)",
    )
    parser.add_argument(
        "--output",
        default="flatpak/generated-nuget-sources.json",
        help="Output JSON file",
    )
    parser.add_argument(
        "--hash-file",
        default="flatpak/generated-nuget-sources.hash",
        help="Stored project hash file",
    )
    parser.add_argument(
        "--dotnet",
        default="9",
        help="Dotnet major version for flatpak-dotnet-generator",
    )
    parser.add_argument(
        "--freedesktop",
        default="25.08",
        help="Freedesktop SDK version for flatpak-dotnet-generator",
    )
    parser.add_argument(
        "--destdir",
        default="flatpak-nuget-sources",
        help="Destination directory inside Flatpak sources output",
    )
    parser.add_argument(
        "--runtime",
        default="linux-x64",
        help="Runtime identifier used for restore dependency graph",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Always regenerate and refresh hash, even when hashes match",
    )
    args = parser.parse_args()

    root = repo_root()
    search_root = Path(args.search_root)
    output = Path(args.output)
    hash_file = Path(args.hash_file)

    default_projects = [
        "extensions/fomod-installer/src/ModInstaller.IPC/ModInstaller.IPC.csproj",
        "extensions/fomod-installer/src/ModInstaller.Native/ModInstaller.Native.csproj",
    ]
    project_args = args.project if args.project else default_projects
    projects = [Path(project) for project in project_args]

    if not search_root.is_absolute():
        search_root = root / search_root
    if not output.is_absolute():
        output = root / output
    if not hash_file.is_absolute():
        hash_file = root / hash_file
    projects = _resolve_paths(projects, root)

    sync_generated_nuget_sources(
        search_root=search_root,
        projects=projects,
        output=output,
        hash_file=hash_file,
        dotnet=args.dotnet,
        freedesktop=args.freedesktop,
        destdir=args.destdir,
        runtime=args.runtime,
        force=args.force,
    )


if __name__ == "__main__":
    main()
