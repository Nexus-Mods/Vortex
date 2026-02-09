#!/usr/bin/env python3
"""Export the build to a local repo and install it for UX testing (run from any directory).

This creates a proper Flatpak installation that appears in software centers like
KDE Discover or GNOME Software for UX testing purposes.
"""

import argparse
import shutil
import subprocess
from pathlib import Path

from _flatpak_env import ensure_flathub_remote, ensure_venv, repo_root, run_command


def is_app_installed(app_id: str) -> bool:
    """Check if a flatpak app is installed."""
    result = subprocess.run(
        ["flatpak", "list", "--app"], capture_output=True, text=True
    )
    return app_id in result.stdout


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export build to local repo and install for UX testing."
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
        "--repo",
        default="flatpak/flatpak-repo",
        help="Local repo directory (default: flatpak/flatpak-repo)",
    )
    parser.add_argument(
        "--remote-name",
        default="vortex-local",
        help="Name for the flatpak remote (default: vortex-local)",
    )
    parser.add_argument(
        "--app-id",
        default="com.nexusmods.vortex",
        help="Flatpak app id (default: com.nexusmods.vortex)",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Export from existing build without rebuilding",
    )
    parser.add_argument(
        "--reinstall",
        action="store_true",
        help="Force reinstall if app is already installed",
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="Run the app after installation",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)

    if shutil.which("flatpak-builder") is None:
        print("flatpak-builder not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    if shutil.which("flatpak") is None:
        print("flatpak not found on PATH.")
        print("Install it with your distro package manager (see CONTRIBUTE.md).")
        print("On NixOS: run 'nix develop'.")
        raise SystemExit(1)

    ensure_flathub_remote()

    root = repo_root()
    build_dir = Path(args.build_dir)
    manifest = Path(args.manifest)
    repo_dir = Path(args.repo)

    if not build_dir.is_absolute():
        build_dir = root / build_dir
    if not manifest.is_absolute():
        manifest = root / manifest
    if not repo_dir.is_absolute():
        repo_dir = root / repo_dir

    # Check if already installed
    already_installed = is_app_installed(args.app_id)
    if already_installed and not args.reinstall:
        print(f"{args.app_id} is already installed.")
        print("Use --reinstall to update it, or --run to just run it.")
        if args.run:
            print(f"\nRunning {args.app_id}...")
            run_command(["flatpak", "run", args.app_id], cwd=root)
        return

    # Export to local repo
    if args.skip_build:
        # Export existing build without rebuilding
        print(f"Exporting {args.app_id} from existing build...")
        if not build_dir.exists():
            print(f"Error: Build directory {build_dir} does not exist.")
            print("Run without --skip-build to perform initial build.")
            raise SystemExit(1)

        print(f"Re-exporting to {repo_dir}...")
        export_cmd = [
            "flatpak",
            "build-export",
            "--update-appstream",
            str(repo_dir),
            str(build_dir),
        ]
        run_command(export_cmd, cwd=root)
    else:
        # Use flatpak-builder to build and export
        print(f"Building and exporting {args.app_id} to local repo...")
        export_cmd = [
            "flatpak-builder",
            "--force-clean",
            "--repo",
            str(repo_dir),
            str(build_dir),
            str(manifest),
        ]
        run_command(export_cmd, cwd=root)

        # Update appstream metadata after build
        print("Updating appstream in repo...")
        run_command(
            [
                "flatpak",
                "build-export",
                "--update-appstream",
                str(repo_dir),
                str(build_dir),
            ],
            cwd=root,
        )

    # Uninstall if reinstalling (keep user data for development)
    if args.reinstall and already_installed:
        print(f"Uninstalling existing {args.app_id}...")
        subprocess.run(
            ["flatpak", "uninstall", "--user", "-y", args.app_id],
            capture_output=True,
        )

    # Update appstream metadata from remotes to pick up changes
    print("Updating AppStream metadata...")
    subprocess.run(
        ["flatpak", "update", "--appstream", "--user"],
        capture_output=True,
    )

    # Add repo as remote
    print(f"Adding local repo as remote '{args.remote_name}'...")
    # Remove existing remote if it exists to avoid caching issues
    subprocess.run(
        ["flatpak", "remote-delete", "--user", args.remote_name],
        capture_output=True,
    )
    subprocess.run(
        [
            "flatpak",
            "remote-add",
            "--user",
            "--no-gpg-verify",
            args.remote_name,
            str(repo_dir),
        ],
        check=True,
    )

    # Install from local repo
    print(f"Installing {args.app_id} from local repo...")
    install_cmd = [
        "flatpak",
        "install",
        "--user",
        "-y",
        args.remote_name,
        args.app_id,
    ]
    run_command(install_cmd, cwd=root)
    print(f"\n{args.app_id} installed successfully!")
    print(f"\nThe app will now appear in software centers like KDE Discover.")
    print(f"You can also run it with: flatpak run {args.app_id}")

    # Run if requested
    if args.run:
        print(f"\nRunning {args.app_id}...")
        run_command(["flatpak", "run", args.app_id], cwd=root)


if __name__ == "__main__":
    main()
