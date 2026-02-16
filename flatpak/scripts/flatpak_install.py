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
    ensure_flatpak_tools()

    ensure_flathub_remote()

    paths = resolve_flatpak_paths(args.build_dir, args.manifest, args.repo)

    # Check if already installed
    already_installed = is_app_installed(args.app_id)
    if already_installed and not args.reinstall:
        print(f"{args.app_id} is already installed.")
        print("Use --reinstall to update it, or --run to just run it.")
        if args.run:
            print(f"\nRunning {args.app_id}...")
            run_command(["flatpak", "run", args.app_id], cwd=paths.root)
        return

    # Export to local repo
    if args.skip_build:
        # Export existing build without rebuilding
        print(f"Exporting {args.app_id} from existing build...")
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

        print(f"Building and exporting {args.app_id} to local repo...")
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
        print(f"Uninstalling existing {args.app_id}...")
        uninstall_user_app(args.app_id)

    # Update appstream metadata from remotes to pick up changes
    print("Updating AppStream metadata...")
    update_user_appstream()

    # Add repo as remote
    print(f"Adding local repo as remote '{args.remote_name}'...")
    reset_user_remote(args.remote_name, paths.repo_dir)

    # Install from local repo
    print(f"Installing {args.app_id} from local repo...")
    install_user_app_from_remote(
        root=paths.root,
        remote_name=args.remote_name,
        app_id=args.app_id,
    )
    print(f"\n{args.app_id} installed successfully!")
    print(f"\nThe app will now appear in software centers like KDE Discover.")
    print(f"You can also run it with: flatpak run {args.app_id}")

    # Run if requested
    if args.run:
        print(f"\nRunning {args.app_id}...")
        run_command(["flatpak", "run", args.app_id], cwd=paths.root)


if __name__ == "__main__":
    main()
