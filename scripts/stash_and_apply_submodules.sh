#!/usr/bin/env bash
set -euo pipefail

# Stash and apply local changes across all submodules to their target branches.
# - Default target branch: macos-experimental
# - Special case: extensions/theme-switcher -> macos-tahoe-theme
# - If a submodule has no upstream set, open its GitHub origin page to allow setting it up.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Stashing and applying changes across submodules..."

git submodule foreach --recursive '
  echo "Processing $path"
  target_branch="macos-experimental"
  if [[ "$path" == "extensions/theme-switcher" ]]; then
    target_branch="macos-tahoe-theme"
  fi

  STASHED=0
  # Detect any local changes, including staged
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git stash push -u -m "auto-stash before branch switch by script $(date +%F_%T)" || true
    STASHED=1
  fi

  # Fetch and switch/create target branch
  git fetch --all --prune || true
  if git rev-parse --verify "$target_branch" >/dev/null 2>&1; then
    git checkout "$target_branch"
  else
    git checkout -b "$target_branch"
  fi

  # Re-apply stashed changes
  if [ "$STASHED" = "1" ]; then
    # Try normal pop; if conflicts, keep stash for manual resolution
    if ! git stash pop; then
      echo "Conflicts while popping stash in $path. Keeping stash for manual resolution."
    fi
  fi

  # If no upstream set, derive web URL from origin and open
  if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
    origin_url=$(git remote get-url origin 2>/dev/null || true)
    if [ -n "$origin_url" ]; then
      if [[ "$origin_url" =~ ^git@github.com:(.*)\.git$ ]]; then
        web_url="https://github.com/${BASH_REMATCH[1]}"
      elif [[ "$origin_url" =~ ^https://github.com/(.*)\.git$ ]]; then
        web_url="https://github.com/${BASH_REMATCH[1]}"
      else
        web_url="$origin_url"
      fi
      echo "Missing upstream for $path -> $web_url"
      # macOS: open in default browser
      open "$web_url" >/dev/null 2>&1 || true
    else
      echo "Missing upstream for $path and no origin url found"
    fi
  fi
'

echo "Done."