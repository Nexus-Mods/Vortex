#!/usr/bin/env python3
"""Shared helpers for Flatpak build and install workflows."""

import shutil
import subprocess
from pathlib import Path
from typing import NamedTuple, Optional

from _flatpak_env import repo_root, run_command
from flatpak_nuget_sources import sync_generated_nuget_sources
from flatpak_sources import sync_generated_sources
from update_metainfo_version import update_metainfo_version


class FlatpakPaths(NamedTuple):
    root: Path
    build_dir: Path
    manifest: Path
    repo_dir: Path


def ensure_tool(tool_name: str) -> None:
    if shutil.which(tool_name) is not None:
        return

    print(f"{tool_name} not found on PATH.")
    print("Install it with your distro package manager (see CONTRIBUTE.md).")
    print("On NixOS: run 'nix develop'.")
    raise SystemExit(1)


def ensure_flatpak_tools(*, require_builder: bool = True) -> None:
    if require_builder:
        ensure_tool("flatpak-builder")
    ensure_tool("flatpak")


def resolve_flatpak_paths(build_dir: str, manifest: str, repo: str) -> FlatpakPaths:
    root = repo_root()
    return FlatpakPaths(
        root=root,
        build_dir=_resolve_path(root, build_dir),
        manifest=_resolve_path(root, manifest),
        repo_dir=_resolve_path(root, repo),
    )


def sync_flatpak_build_inputs(root: Path) -> None:
    sync_generated_sources(
        lockfile=root / "yarn.lock",
        output=root / "flatpak/generated-sources.json",
        hash_file=root / "flatpak/generated-sources.hash",
        recursive=True,
    )

    sync_generated_nuget_sources(
        search_root=root / "extensions/fomod-installer",
        projects=[
            root
            / "extensions/fomod-installer/src/ModInstaller.IPC/ModInstaller.IPC.csproj",
            root
            / "extensions/fomod-installer/src/ModInstaller.Native/ModInstaller.Native.csproj",
        ],
        output=root / "flatpak/generated-nuget-sources.json",
        hash_file=root / "flatpak/generated-nuget-sources.hash",
        dotnet="9",
        freedesktop="25.08",
        destdir="flatpak-nuget-sources",
        runtime="linux-x64",
    )

    update_metainfo_version(root)


def run_flatpak_builder(
    *,
    root: Path,
    build_dir: Path,
    manifest: Path,
    repo_dir: Optional[Path] = None,
    install_deps_from: Optional[str] = None,
    user_install: bool = False,
) -> None:
    cmd = ["flatpak-builder", "--force-clean"]

    if repo_dir is not None:
        cmd.extend(["--repo", str(repo_dir)])

    cmd.extend([str(build_dir), str(manifest)])

    if install_deps_from:
        cmd.extend(["--install-deps-from", install_deps_from])

    if user_install:
        cmd.append("--user")

    run_command(cmd, cwd=root)


def export_build_to_repo(
    *, root: Path, repo_dir: Path, build_dir: Path, update_appstream: bool = True
) -> None:
    cmd = ["flatpak", "build-export"]
    if update_appstream:
        cmd.append("--update-appstream")
    cmd.extend([str(repo_dir), str(build_dir)])
    run_command(cmd, cwd=root)


def is_app_installed(app_id: str) -> bool:
    result = subprocess.run(
        ["flatpak", "list", "--app"], capture_output=True, text=True
    )
    return app_id in result.stdout


def uninstall_user_app(app_id: str) -> None:
    subprocess.run(
        ["flatpak", "uninstall", "--user", "-y", app_id], capture_output=True
    )


def update_user_appstream() -> None:
    subprocess.run(["flatpak", "update", "--appstream", "--user"], capture_output=True)


def reset_user_remote(remote_name: str, repo_dir: Path) -> None:
    subprocess.run(
        ["flatpak", "remote-delete", "--user", remote_name],
        capture_output=True,
    )
    subprocess.run(
        [
            "flatpak",
            "remote-add",
            "--user",
            "--no-gpg-verify",
            remote_name,
            str(repo_dir),
        ],
        check=True,
    )


def install_user_app_from_remote(*, root: Path, remote_name: str, app_id: str) -> None:
    run_command(["flatpak", "install", "--user", "-y", remote_name, app_id], cwd=root)


def install_user_app_from_build(
    *,
    root: Path,
    build_dir: Path,
    repo_dir: Path,
    remote_name: str,
    app_id: str,
) -> None:
    export_build_to_repo(root=root, repo_dir=repo_dir, build_dir=build_dir)
    update_user_appstream()
    reset_user_remote(remote_name, repo_dir)
    install_user_app_from_remote(root=root, remote_name=remote_name, app_id=app_id)


def _resolve_path(root: Path, path_value: str) -> Path:
    path = Path(path_value)
    if not path.is_absolute():
        path = root / path
    return path
