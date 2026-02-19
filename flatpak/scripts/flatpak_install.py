#!/usr/bin/env python3
"""Export the build to a local repo and install it for UX testing (run from any directory).

This creates a proper Flatpak installation that appears in software centers like
KDE Discover or GNOME Software for UX testing purposes.
"""

import argparse

from _flatpak_env import ensure_flathub_remote, ensure_venv, run_command
from _flatpak_workflow import (
    ensure_flatpak_tools,
    export_build_to_repo,
    install_user_app_from_remote,
    is_app_installed,
    resolve_flatpak_paths,
    reset_user_remote,
    run_flatpak_builder,
    sync_flatpak_build_inputs,
    uninstall_user_app,
    update_user_appstream,
)


DEFAULT_BUILD_DIR = "build-flatpak"
DEFAULT_MANIFEST = "flatpak/com.nexusmods.vortex.yaml"
DEFAULT_REPO = "flatpak/flatpak-repo"
DEFAULT_REMOTE_NAME = "vortex-local"
DEFAULT_APP_ID = "com.nexusmods.vortex"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export build to local repo and install for UX testing."
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
    ensure_flatpak_tools()

    ensure_flathub_remote()

    paths = resolve_flatpak_paths(DEFAULT_BUILD_DIR, DEFAULT_MANIFEST, DEFAULT_REPO)

    # Check if already installed
    already_installed = is_app_installed(DEFAULT_APP_ID)
    if already_installed and not args.reinstall:
        print(f"{DEFAULT_APP_ID} is already installed.")
        print("Use --reinstall to update it, or --run to just run it.")
        if args.run:
            print(f"\nRunning {DEFAULT_APP_ID}...")
            run_command(["flatpak", "run", DEFAULT_APP_ID], cwd=paths.root)
        return

    # Export to local repo
    if args.skip_build:
        # Export existing build without rebuilding
        print(f"Exporting {DEFAULT_APP_ID} from existing build...")
        if not paths.build_dir.exists():
            print(f"Error: Build directory {paths.build_dir} does not exist.")
            print("Run without --skip-build to perform initial build.")
            raise SystemExit(1)

        print(f"Re-exporting to {paths.repo_dir}...")
        export_build_to_repo(
            root=paths.root,
            repo_dir=paths.repo_dir,
            build_dir=paths.build_dir,
        )
    else:
        # Use flatpak-builder to build and export
        sync_flatpak_build_inputs(paths.root)

        print(f"Building and exporting {DEFAULT_APP_ID} to local repo...")
        run_flatpak_builder(
            root=paths.root,
            build_dir=paths.build_dir,
            manifest=paths.manifest,
            repo_dir=paths.repo_dir,
        )

        # Update appstream metadata after build
        print("Updating appstream in repo...")
        export_build_to_repo(
            root=paths.root,
            repo_dir=paths.repo_dir,
            build_dir=paths.build_dir,
        )

    # Uninstall if reinstalling (keep user data for development)
    if args.reinstall and already_installed:
        print(f"Uninstalling existing {DEFAULT_APP_ID}...")
        uninstall_user_app(DEFAULT_APP_ID)

    # Update appstream metadata from remotes to pick up changes
    print("Updating AppStream metadata...")
    update_user_appstream()

    # Add repo as remote
    print(f"Adding local repo as remote '{DEFAULT_REMOTE_NAME}'...")
    reset_user_remote(DEFAULT_REMOTE_NAME, paths.repo_dir)

    # Install from local repo
    print(f"Installing {DEFAULT_APP_ID} from local repo...")
    install_user_app_from_remote(
        root=paths.root,
        remote_name=DEFAULT_REMOTE_NAME,
        app_id=DEFAULT_APP_ID,
    )
    print(f"\n{DEFAULT_APP_ID} installed successfully!")
    print(f"\nThe app will now appear in software centers like KDE Discover.")
    print(f"You can also run it with: flatpak run {DEFAULT_APP_ID}")

    # Run if requested
    if args.run:
        print(f"\nRunning {DEFAULT_APP_ID}...")
        run_command(["flatpak", "run", DEFAULT_APP_ID], cwd=paths.root)


if __name__ == "__main__":
    main()
