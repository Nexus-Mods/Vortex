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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the Flatpak build, installing if necessary."
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

    paths = resolve_flatpak_paths(args.build_dir, args.manifest, args.repo)

    # Check if app is installed and if build exists
    already_installed = is_app_installed(args.app_id)
    build_exists = paths.build_dir.exists()

    if args.skip_build:
        if not already_installed:
            print(f"Error: {args.app_id} is not installed.")
            print("Run without --skip-build to build and install it.")
            raise SystemExit(1)
        print(f"Running installed {args.app_id}...")
    else:
        if args.reinstall and already_installed:
            print(f"Reinstalling {args.app_id}...")
            uninstall_user_app(args.app_id)
            already_installed = False

        should_build = args.reinstall or not build_exists

        if should_build:
            if args.reinstall and not already_installed:
                print(f"Rebuilding {args.app_id} before reinstall...")
            elif not build_exists:
                print(f"{args.app_id} build not found. Building...")

            sync_flatpak_build_inputs(paths.root)

            print(f"Building {args.app_id}...")
            run_flatpak_builder(
                root=paths.root,
                build_dir=paths.build_dir,
                manifest=paths.manifest,
                repo_dir=paths.repo_dir,
            )

            print(f"Installing {args.app_id} from local build...")
            install_user_app_from_build(
                root=paths.root,
                build_dir=paths.build_dir,
                repo_dir=paths.repo_dir,
                remote_name=args.remote_name,
                app_id=args.app_id,
            )
            print(f"\n{args.app_id} installed successfully!")
        elif not already_installed:
            print(f"{args.app_id} not installed. Exporting from existing build...")
            install_user_app_from_build(
                root=paths.root,
                build_dir=paths.build_dir,
                repo_dir=paths.repo_dir,
                remote_name=args.remote_name,
                app_id=args.app_id,
            )
            print(f"\n{args.app_id} installed successfully!")
        else:
            print(f"{args.app_id} is already installed. Running...")
            print("Use --reinstall to rebuild and reinstall.")

    # Run the installed app
    run_cmd = ["flatpak", "run"]
    if args.log:
        run_cmd.append("--env=VORTEX_ENABLE_LOGGING=1")
    run_cmd.append(args.app_id)
    if args.command_args:
        run_cmd.extend(args.command_args)

    run_command(run_cmd, cwd=paths.root)


if __name__ == "__main__":
    main()
