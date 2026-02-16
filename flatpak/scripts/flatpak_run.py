#!/usr/bin/env python3
"""Run the Flatpak build, installing if necessary (run from any directory).

This ensures single-instance behavior works correctly by always running the
installed Flatpak (not flatpak-builder --run), so protocol handlers forward
to the same executable.
"""

import argparse

from _flatpak_env import ensure_flathub_remote, ensure_venv, run_command
from _flatpak_workflow import (
    ensure_flatpak_tools,
    install_user_app_from_build,
    is_app_installed,
    resolve_flatpak_paths,
    run_flatpak_builder,
    sync_flatpak_build_inputs,
    uninstall_user_app,
)


DEFAULT_BUILD_DIR = "build-flatpak"
DEFAULT_MANIFEST = "flatpak/com.nexusmods.vortex.yaml"
DEFAULT_REPO = "flatpak/flatpak-repo"
DEFAULT_REMOTE_NAME = "vortex-local"
DEFAULT_APP_ID = "com.nexusmods.vortex"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the Flatpak build, installing if necessary."
    )
    parser.add_argument(
        "--reinstall",
        action="store_true",
        help="Force reinstall (rebuild and reinstall)",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip build, just run installed app (fails if not installed)",
    )
    parser.add_argument(
        "--log",
        action="store_true",
        help="Enable console logging (sets VORTEX_ENABLE_LOGGING=1)",
    )
    parser.add_argument(
        "command_args",
        nargs=argparse.REMAINDER,
        help="Arguments passed to the app (use -- to separate)",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)
    ensure_flatpak_tools()

    ensure_flathub_remote()

    paths = resolve_flatpak_paths(DEFAULT_BUILD_DIR, DEFAULT_MANIFEST, DEFAULT_REPO)

    # Check if app is installed and if build exists
    already_installed = is_app_installed(DEFAULT_APP_ID)
    build_exists = paths.build_dir.exists()

    if args.skip_build:
        if not already_installed:
            print(f"Error: {DEFAULT_APP_ID} is not installed.")
            print("Run without --skip-build to build and install it.")
            raise SystemExit(1)
        print(f"Running installed {DEFAULT_APP_ID}...")
    else:
        if args.reinstall and already_installed:
            print(f"Reinstalling {DEFAULT_APP_ID}...")
            uninstall_user_app(DEFAULT_APP_ID)
            already_installed = False

        should_build = args.reinstall or not build_exists

        if should_build:
            if args.reinstall and not already_installed:
                print(f"Rebuilding {DEFAULT_APP_ID} before reinstall...")
            elif not build_exists:
                print(f"{DEFAULT_APP_ID} build not found. Building...")

            sync_flatpak_build_inputs(paths.root)

            print(f"Building {DEFAULT_APP_ID}...")
            run_flatpak_builder(
                root=paths.root,
                build_dir=paths.build_dir,
                manifest=paths.manifest,
                repo_dir=paths.repo_dir,
            )

            print(f"Installing {DEFAULT_APP_ID} from local build...")
            install_user_app_from_build(
                root=paths.root,
                build_dir=paths.build_dir,
                repo_dir=paths.repo_dir,
                remote_name=DEFAULT_REMOTE_NAME,
                app_id=DEFAULT_APP_ID,
            )
            print(f"\n{DEFAULT_APP_ID} installed successfully!")
        elif not already_installed:
            print(f"{DEFAULT_APP_ID} not installed. Exporting from existing build...")
            install_user_app_from_build(
                root=paths.root,
                build_dir=paths.build_dir,
                repo_dir=paths.repo_dir,
                remote_name=DEFAULT_REMOTE_NAME,
                app_id=DEFAULT_APP_ID,
            )
            print(f"\n{DEFAULT_APP_ID} installed successfully!")
        else:
            print(f"{DEFAULT_APP_ID} is already installed. Running...")
            print("Use --reinstall to rebuild and reinstall.")

    # Run the installed app
    run_cmd = ["flatpak", "run"]
    if args.log:
        run_cmd.append("--env=VORTEX_ENABLE_LOGGING=1")
    run_cmd.append(DEFAULT_APP_ID)
    if args.command_args:
        run_cmd.extend(args.command_args)

    run_command(run_cmd, cwd=paths.root)


if __name__ == "__main__":
    main()
