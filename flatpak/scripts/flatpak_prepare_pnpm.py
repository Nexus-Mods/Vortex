#!/usr/bin/env python3
"""Prepare the copied Flatpak build tree for offline pnpm installation."""

import json
from pathlib import Path
from typing import Callable, List


def remove_yaml_mapping_entries(text: str, should_remove: Callable[[str], bool]) -> str:
    output: List[str] = []
    skipping = False
    entry_indent = 0

    for line in text.splitlines(keepends=True):
        current = line.rstrip("\n")
        if not skipping and should_remove(current):
            skipping = True
            entry_indent = len(line) - len(line.lstrip())
            continue

        if skipping:
            stripped = line.strip()
            indent = len(line) - len(line.lstrip())
            if stripped and indent <= entry_indent:
                skipping = False
                output.append(line)
            continue

        output.append(line)

    return "".join(output)


def remove_yaml_mapping_entry(text: str, entry_line: str) -> str:
    return remove_yaml_mapping_entries(text, lambda line: line == entry_line)


def normalize_pnpm_lockfile_text(text: str) -> str:
    if "\n---\n" in text:
        _, text = text.split("\n---\n", 1)

    text = remove_yaml_mapping_entries(
        text,
        lambda line: line.startswith("  node@runtime:"),
    )
    text = remove_yaml_mapping_entry(text, "      node:")
    return "---\n" + text.lstrip()


def normalize_pnpm_lockfile(lockfile: Path) -> str:
    return normalize_pnpm_lockfile_text(lockfile.read_text(encoding="utf-8"))


def remove_managed_node_runtime(root: Path) -> None:
    package_path = root / "package.json"
    package_data = json.loads(package_path.read_text(encoding="utf-8"))

    dependencies = package_data.get("dependencies")
    if isinstance(dependencies, dict):
        dependencies.pop("node", None)
        if not dependencies:
            package_data.pop("dependencies", None)

    dev_engines = package_data.get("devEngines")
    if isinstance(dev_engines, dict):
        dev_engines.pop("runtime", None)
        if not dev_engines:
            package_data.pop("devEngines", None)

    package_path.write_text(
        json.dumps(package_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def normalize_lockfile(root: Path) -> None:
    lockfile = root / "pnpm-lock.yaml"
    lockfile.write_text(normalize_pnpm_lockfile(lockfile), encoding="utf-8")


def main() -> None:
    root = Path.cwd()
    remove_managed_node_runtime(root)
    normalize_lockfile(root)


if __name__ == "__main__":
    main()
