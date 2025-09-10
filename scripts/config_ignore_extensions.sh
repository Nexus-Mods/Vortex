#!/usr/bin/env bash
set -euo pipefail

# Run from repo root
cd "$(dirname "$0")/.."

# Iterate submodules defined in .gitmodules and set ignore=all for those under extensions/
# This prevents the superproject from tracking submodule commit changes in status/commits.
if [ ! -f .gitmodules ]; then
  echo ".gitmodules not found; nothing to configure."
  exit 0
fi

# Get all submodule path entries: lines like
# submodule.extensions/theme-switcher.path extensions/theme-switcher
while IFS=$'\n' read -r line; do
  # Split key and value (key contains submodule.<name>.path)
  key=${line%% *}
  path=${line#* }
  case "$path" in
    extensions/*)
      name=${key#submodule.}
      name=${name%.path}
      echo "Setting ignore=all for submodule: $name ($path)"
      git config -f .gitmodules "submodule.$name.ignore" all
      ;;
  esac
done < <(git config -f .gitmodules --get-regexp '^submodule\..*\.path' || true)

# Sync submodule config to local .git/config
git submodule sync --recursive || true

echo "Verification (.gitmodules ignore settings):"
(git config -f .gitmodules --get-regexp '^submodule\..*\.ignore' || true)

echo "Done configuring submodule ignore settings."