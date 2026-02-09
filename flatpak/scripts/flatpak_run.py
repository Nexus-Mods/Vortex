#!/usr/bin/env python3
"""Run the Flatpak build output via flatpak-builder --run (run from any directory)."""

import argparse
import shutil
from pathlib import Path

from _flatpak_env import ensure_flathub_remote, ensure_venv, repo_root, run_command


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the Flatpak build output with flatpak-builder --run."
    )
    parser.add_argument(
        "--build-dir",
        default="build-flatpak",
        help="Build output directory (default: build-flatpak)",
    )
    parser.add_argument(
        "--manifest",
        default="flatpak/com.nexusmods.vortex.yaml",
        help="Flatpak manifest path (default: flatpak/com.nexusmods.vortex.yaml)",
    )
    parser.add_argument(
        "--command",
        default="/app/bin/run.sh",
        help="Command to run inside the build (default: /app/bin/run.sh)",
    )
    parser.add_argument(
        "--log",
        action="store_true",
        help="Enable console logging (sets VORTEX_ENABLE_LOGGING=1)",
    )
    parser.add_argument(
        "command_args",
        nargs=argparse.REMAINDER,
        help="Arguments passed to the command (use -- to separate)",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)

    if shutil.which("flatpak-builder") is None:
        print("flatpak-builder not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    ensure_flathub_remote()

    root = repo_root()
    build_dir = Path(args.build_dir)
    manifest = Path(args.manifest)
    if not build_dir.is_absolute():
        build_dir = root / build_dir
    if not manifest.is_absolute():
        manifest = root / manifest

    cmd = ["flatpak-builder", "--run", str(build_dir), str(manifest), args.command]
    if args.log:
        cmd.extend(["--env=VORTEX_ENABLE_LOGGING=1"])
    if args.command_args:
        cmd.extend(args.command_args)

    run_command(cmd, cwd=root)


if __name__ == "__main__":
    main()
