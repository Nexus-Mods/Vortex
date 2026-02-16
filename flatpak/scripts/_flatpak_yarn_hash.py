#!/usr/bin/env python3
"""Hash helpers for Flatpak generated-sources synchronization."""

import hashlib
import os
from pathlib import Path
from typing import List, Optional, Tuple

from _flatpak_env import repo_root


IGNORED_RECURSIVE_DIRS = {
    ".git",
    ".flatpak-builder",
    ".venv-flatpak",
    "flatpak-repo",
    "node_modules",
    "build-flatpak",
    "dist",
    "out",
}


def _collect_recursive_lockfiles(root: Path) -> List[Path]:
    lockfiles: List[Path] = []
    for current_root, dirnames, filenames in os.walk(root):
        current = Path(current_root)

        # Keep traversal fast and avoid generated/cache directories.
        dirnames[:] = [
            dirname
            for dirname in dirnames
            if dirname not in IGNORED_RECURSIVE_DIRS and not dirname.startswith(".venv")
        ]

        if "yarn.lock" in filenames:
            lockfiles.append(current / "yarn.lock")

    return sorted(lockfiles, key=lambda path: path.relative_to(root).as_posix())


def collect_lockfiles(lockfile: Path, recursive: bool) -> List[Path]:
    root = repo_root()
    if not lockfile.is_absolute():
        lockfile = root / lockfile

    if recursive:
        lockfiles = _collect_recursive_lockfiles(root)
        if lockfile.exists() and lockfile not in lockfiles:
            lockfiles.append(lockfile)
            lockfiles = sorted(
                lockfiles, key=lambda path: path.relative_to(root).as_posix()
            )
        if not lockfiles:
            raise FileNotFoundError("No yarn.lock files found in repository.")
        return lockfiles

    if not lockfile.exists():
        raise FileNotFoundError(f"Lockfile not found: {lockfile}")
    return [lockfile]


def compute_sources_hash(lockfile: Path, recursive: bool) -> Tuple[str, List[Path]]:
    root = repo_root()
    lockfiles = collect_lockfiles(lockfile=lockfile, recursive=recursive)

    digest = hashlib.sha256()
    digest.update(b"flatpak-generated-sources-hash-v1\n")

    for path in lockfiles:
        relative = path.relative_to(root).as_posix()
        contents = path.read_bytes()
        digest.update(f"path:{relative}\n".encode("utf-8"))
        digest.update(f"size:{len(contents)}\n".encode("utf-8"))
        digest.update(contents)
        digest.update(b"\n")

    return digest.hexdigest(), lockfiles


def read_stored_hash(hash_file: Path) -> Optional[str]:
    if not hash_file.exists():
        return None
    value = hash_file.read_text(encoding="utf-8").strip()
    return value or None


def write_stored_hash(hash_file: Path, value: str) -> None:
    hash_file.parent.mkdir(parents=True, exist_ok=True)
    hash_file.write_text(f"{value}\n", encoding="utf-8")
