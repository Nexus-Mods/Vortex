#!/usr/bin/env python3
"""Build the Flatpak using flatpak-builder and the repo manifest (run from any directory)."""

import argparse

from _flatpak_env import ensure_flathub_remote, ensure_venv
from _flatpak_workflow import (
    ensure_flatpak_tools,
    resolve_flatpak_paths,
    run_flatpak_builder,
    sync_flatpak_build_inputs,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the Vortex Flatpak using flatpak-builder."
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
        "--install-deps-from",
        default="flathub",
        help="Remote for runtime deps (default: flathub)",
    )
    parser.add_argument(
        "--system",
        action="store_true",
        help="Install dependencies system-wide (default: --user)",
    )
    args = parser.parse_args()

    ensure_venv(install_packages=False)
    ensure_flatpak_tools()
    ensure_flathub_remote()

    paths = resolve_flatpak_paths(args.build_dir, args.manifest, args.repo)

    sync_flatpak_build_inputs(paths.root)

    run_flatpak_builder(
        root=paths.root,
        build_dir=paths.build_dir,
        manifest=paths.manifest,
        install_deps_from=args.install_deps_from,
        user_install=not args.system,
    )


if __name__ == "__main__":
    main()
