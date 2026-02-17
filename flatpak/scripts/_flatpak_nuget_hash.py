#!/usr/bin/env python3
"""Hash helpers for Flatpak generated NuGet source synchronization."""

import hashlib
import os
from pathlib import Path
from typing import List, Optional, Tuple

from _flatpak_env import repo_root


IGNORED_RECURSIVE_DIRS = {
    ".git",
    ".flatpak-builder",
    ".venv-flatpak",
    "bin",
    "obj",
    "node_modules",
}


def _is_nuget_input_file(filename: str) -> bool:
    lowered = filename.lower()
    if lowered.endswith(".csproj"):
        return True
    if lowered.endswith(".props"):
        return True
    if lowered.endswith(".targets"):
        return True
    if lowered.endswith(".sln"):
        return True
    if lowered.endswith(".lock.json"):
        return True
    if lowered in {"global.json", "nuget.config", "packages.config"}:
        return True
    return False


def collect_nuget_input_files(search_root: Path) -> List[Path]:
    root = repo_root()
    if not search_root.is_absolute():
        search_root = root / search_root

    if not search_root.exists():
        raise FileNotFoundError(f"NuGet search root not found: {search_root}")

    files: List[Path] = []
    for current_root, dirnames, filenames in os.walk(search_root):
        current = Path(current_root)
        dirnames[:] = [
            dirname
            for dirname in dirnames
            if dirname not in IGNORED_RECURSIVE_DIRS and not dirname.startswith(".venv")
        ]

        for filename in filenames:
            if _is_nuget_input_file(filename):
                files.append(current / filename)

    if not files:
        raise FileNotFoundError(f"No NuGet input files found under: {search_root}")

    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def compute_nuget_sources_hash(search_root: Path) -> Tuple[str, List[Path]]:
    root = repo_root()
    files = collect_nuget_input_files(search_root=search_root)

    digest = hashlib.sha256()
    digest.update(b"flatpak-generated-nuget-sources-hash-v1\n")

    for path in files:
        relative = path.relative_to(root).as_posix()
        contents = path.read_bytes()
        digest.update(f"path:{relative}\n".encode("utf-8"))
        digest.update(f"size:{len(contents)}\n".encode("utf-8"))
        digest.update(contents)
        digest.update(b"\n")

    return digest.hexdigest(), files


def read_stored_hash(hash_file: Path) -> Optional[str]:
    if not hash_file.exists():
        return None
    value = hash_file.read_text(encoding="utf-8").strip()
    return value or None


def write_stored_hash(hash_file: Path, value: str) -> None:
    hash_file.parent.mkdir(parents=True, exist_ok=True)
    hash_file.write_text(f"{value}\n", encoding="utf-8")
