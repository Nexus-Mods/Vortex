#!/usr/bin/env python3
"""Create the Flatpak helper venv and install generator tools (run from any directory)."""

import argparse

from _flatpak_env import ensure_venv, repo_root


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create the Flatpak helper venv and install dependencies."
    )
    parser.parse_args()

    info = ensure_venv(install_packages=True)

    print("Flatpak venv ready.")
    print(f"Repo: {repo_root()}")
    print(f"Venv: {info.venv_dir}")
    print(f"Python: {info.python_exe}")
    print(f"flatpak-node-generator: {info.flatpak_node_generator}")
    print(f"flatpak-dotnet-generator: {info.flatpak_dotnet_generator}")


if __name__ == "__main__":
    main()
