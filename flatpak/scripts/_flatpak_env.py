#!/usr/bin/env python3
"""Shared helpers for Flatpak wrapper scripts (run from any directory)."""

import os
import subprocess
import sys
from pathlib import Path
from typing import NamedTuple


class VenvInfo(NamedTuple):
    venv_dir: Path
    bin_dir: Path
    python_exe: Path
    pip_exe: Path
    flatpak_node_generator: Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def venv_dir() -> Path:
    return repo_root() / "flatpak" / ".venv-flatpak"


def run_command(cmd, cwd=None):
    print(f"Running: {' '.join(str(c) for c in cmd)}")
    try:
        subprocess.run(cmd, cwd=cwd, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"Error running command: {exc}")
        sys.exit(1)


def _venv_paths(venv: Path) -> VenvInfo:
    if os.name == "nt":
        bin_dir = venv / "Scripts"
        python_exe = bin_dir / "python.exe"
        pip_exe = bin_dir / "pip.exe"
        flatpak_node_generator = bin_dir / "flatpak-node-generator.exe"
    else:
        bin_dir = venv / "bin"
        python_exe = bin_dir / "python"
        pip_exe = bin_dir / "pip"
        flatpak_node_generator = bin_dir / "flatpak-node-generator"

    return VenvInfo(
        venv_dir=venv,
        bin_dir=bin_dir,
        python_exe=python_exe,
        pip_exe=pip_exe,
        flatpak_node_generator=flatpak_node_generator,
    )


def _pip_has_package(pip_exe: Path, package: str) -> bool:
    result = subprocess.run(
        [str(pip_exe), "show", package],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


def ensure_venv(install_packages: bool = True) -> VenvInfo:
    venv = venv_dir()
    if not venv.exists():
        print(f"Creating virtual environment at {venv}...")
        run_command([sys.executable, "-m", "venv", str(venv)], cwd=repo_root())

    info = _venv_paths(venv)
    if not info.python_exe.exists():
        print(f"Virtual environment python not found at {info.python_exe}")
        sys.exit(1)

    if install_packages:
        if not _pip_has_package(info.pip_exe, "flatpak-node-generator"):
            run_command(
                [str(info.pip_exe), "install", "flatpak-node-generator"],
                cwd=repo_root(),
            )

    return info
