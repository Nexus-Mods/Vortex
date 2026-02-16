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


DEFAULT_BUILD_DIR = "build-flatpak"
DEFAULT_MANIFEST = "flatpak/com.nexusmods.vortex.yaml"
DEFAULT_REPO = "flatpak/flatpak-repo"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the Vortex Flatpak using flatpak-builder."
    )
    parser.parse_args()

    ensure_venv(install_packages=False)
    ensure_flatpak_tools()
    ensure_flathub_remote()

    paths = resolve_flatpak_paths(DEFAULT_BUILD_DIR, DEFAULT_MANIFEST, DEFAULT_REPO)

    sync_flatpak_build_inputs(paths.root)

    run_flatpak_builder(
        root=paths.root,
        build_dir=paths.build_dir,
        manifest=paths.manifest,
        install_deps_from="flathub",
        user_install=True,
    )


if __name__ == "__main__":
    main()
