#!/usr/bin/env python3
"""Generate and sync Flatpak source manifests for pnpm and NuGet inputs."""

import argparse
import hashlib
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Iterable, Iterator, List, Optional, Tuple

from _flatpak_env import ensure_venv, repo_root, run_command
from _flatpak_nuget_hash import (
    collect_nuget_input_files,
    compute_nuget_sources_hash,
    read_stored_hash as read_nuget_stored_hash,
    write_stored_hash as write_nuget_stored_hash,
)

DEFAULT_LOCKFILE = "pnpm-lock.yaml"
DEFAULT_NODE_OUTPUT = "flatpak/generated-sources.json"
DEFAULT_NODE_HASH_FILE = "flatpak/generated-sources.hash"
DEFAULT_PNPM_STORE_VERSION = "v11"
DEFAULT_NUGET_SEARCH_ROOT = "extensions"
DEFAULT_NUGET_OUTPUT = "flatpak/generated-nuget-sources.json"
DEFAULT_NUGET_HASH_FILE = "flatpak/generated-nuget-sources.hash"
DEFAULT_DOTNET = "9"
DEFAULT_FREEDESKTOP = "25.08"
DEFAULT_DESTDIR = "flatpak-nuget-sources"
DEFAULT_RUNTIME = "linux-x64"


def _remove_yaml_mapping_entries(
    text: str, should_remove: Callable[[str], bool]
) -> str:
    output: List[str] = []
    skipping = False
    entry_indent = 0

    for line in text.splitlines(keepends=True):
        current = line.rstrip("\n")
        if not skipping and should_remove(current):
            skipping = True
            entry_indent = len(line) - len(line.lstrip())
            continue

        if skipping:
            stripped = line.strip()
            indent = len(line) - len(line.lstrip())
            if stripped and indent <= entry_indent:
                skipping = False
                output.append(line)
            continue

        output.append(line)

    return "".join(output)


def _remove_yaml_mapping_entry(text: str, entry_line: str) -> str:
    return _remove_yaml_mapping_entries(text, lambda line: line == entry_line)


def normalize_pnpm_lockfile_text(text: str) -> str:
    if "\n---\n" in text:
        _, text = text.split("\n---\n", 1)

    text = _remove_yaml_mapping_entries(
        text,
        lambda line: line.startswith("  node@runtime:"),
    )
    text = _remove_yaml_mapping_entry(text, "      node:")
    return "---\n" + text.lstrip()


def normalize_pnpm_lockfile(lockfile: Path) -> str:
    return normalize_pnpm_lockfile_text(lockfile.read_text(encoding="utf-8"))


def collect_lockfiles(lockfile: Path) -> List[Path]:
    root = repo_root()
    if not lockfile.is_absolute():
        lockfile = root / lockfile

    if not lockfile.exists():
        raise FileNotFoundError(f"Lockfile not found: {lockfile}")
    return [lockfile]


def compute_sources_hash(lockfile: Path) -> Tuple[str, List[Path]]:
    root = repo_root()
    lockfiles = collect_lockfiles(lockfile=lockfile)

    digest = hashlib.sha256()
    digest.update(b"flatpak-pnpm-generated-sources-hash-v1\n")

    for path in lockfiles:
        relative = path.relative_to(root).as_posix()
        contents = path.read_bytes()
        digest.update(f"path:{relative}\n".encode("utf-8"))
        digest.update(f"size:{len(contents)}\n".encode("utf-8"))
        digest.update(contents)
        digest.update(b"\n")

    return digest.hexdigest(), lockfiles


def read_sources_stored_hash(hash_file: Path) -> Optional[str]:
    if not hash_file.exists():
        return None
    value = hash_file.read_text(encoding="utf-8").strip()
    return value or None


def write_sources_stored_hash(hash_file: Path, value: str) -> None:
    hash_file.parent.mkdir(parents=True, exist_ok=True)
    hash_file.write_text(f"{value}\n", encoding="utf-8")


@contextmanager
def normalized_pnpm_lockfile(lockfile: Path) -> Iterator[Path]:
    normalized = normalize_pnpm_lockfile(lockfile)

    if normalized == lockfile.read_text(encoding="utf-8"):
        yield lockfile
        return

    with tempfile.NamedTemporaryFile(
        "w",
        delete=False,
        dir=lockfile.parent,
        encoding="utf-8",
        prefix=".flatpak-pnpm-lock-",
        suffix=".yaml",
    ) as temp_lockfile:
        temp_lockfile.write(normalized)
        temp_path = Path(temp_lockfile.name)

    try:
        yield temp_path
    finally:
        temp_path.unlink(missing_ok=True)


def generate_sources(
    lockfile: Path,
    output: Path,
) -> None:
    info = ensure_venv(install_packages=True)

    root = repo_root()

    with normalized_pnpm_lockfile(lockfile) as generator_lockfile:
        cmd = [
            str(info.flatpak_node_generator),
            "pnpm",
            str(generator_lockfile),
            "-o",
            str(output),
            "--pnpm-store-version",
            DEFAULT_PNPM_STORE_VERSION,
        ]
        run_command(cmd, cwd=root)


def sync_generated_sources(
    lockfile: Path,
    output: Path,
    hash_file: Path,
    force: bool = False,
) -> bool:
    root = repo_root()
    if not lockfile.is_absolute():
        lockfile = root / lockfile
    if not output.is_absolute():
        output = root / output
    if not hash_file.is_absolute():
        hash_file = root / hash_file

    source_hash, _ = compute_sources_hash(lockfile=lockfile)
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
        choices=("all", "pnpm", "nuget"),
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

    run_pnpm = args.only in {"all", "pnpm"}
    run_nuget = args.only in {"all", "nuget"}

    if run_pnpm:
        sync_generated_sources(
            lockfile=Path(DEFAULT_LOCKFILE),
            output=Path(DEFAULT_NODE_OUTPUT),
            hash_file=Path(DEFAULT_NODE_HASH_FILE),
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
