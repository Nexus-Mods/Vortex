#!/usr/bin/env bash
set -euo pipefail

# For each submodule:
# - Ensure .DS_Store is listed in .gitignore (create if missing)
# - Untrack any .DS_Store files already tracked
# - Commit with a clear message if there are changes
# - Push to origin on the current branch (set upstream if missing)
# - If detached HEAD, switch to expected branch (macos-experimental; theme-switcher: macos-tahoe-theme)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Ensuring .DS_Store is ignored, committed, and pushed across submodules..."

git submodule foreach --recursive '
  echo "Processing $path"

  # Determine target branch if we encounter detached HEAD
  target_branch="macos-experimental"
  if [[ "$path" == "extensions/theme-switcher" ]]; then
    target_branch="macos-tahoe-theme"
  fi

  current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
  if [[ "$current_branch" == "HEAD" ]]; then
    echo "Detached HEAD detected, switching to $target_branch"
    git fetch --all --prune || true
    if git rev-parse --verify "$target_branch" >/dev/null 2>&1; then
      git checkout "$target_branch"
    else
      git checkout -b "$target_branch"
    fi
    current_branch="$target_branch"
  fi

  # Ensure .DS_Store is in .gitignore
  if [[ -f .gitignore ]]; then
    if ! grep -qxF ".DS_Store" .gitignore; then
      echo ".DS_Store" >> .gitignore
    fi
  else
    echo ".DS_Store" > .gitignore
  fi
  git add .gitignore || true

  # Untrack any now-ignored files (including .DS_Store anywhere)
  # This lists tracked files that match ignore rules and untracks them.
  IGNORED_TRACKED=$(git ls-files -z -i --exclude-standard || true)
  if [[ -n "$IGNORED_TRACKED" ]]; then
    # shellcheck disable=SC2086
    printf "%s" "$IGNORED_TRACKED" | xargs -0 -r git rm --cached -f --
  fi

  # Only commit if there are changes
  if ! git diff --cached --quiet || ! git diff --quiet; then
    git commit -m "chore(git): ignore .DS_Store (macOS) and untrack existing files"

    # Push to origin; set upstream if missing
    if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
      git push
    else
      git push -u origin "$current_branch"
    fi
  else
    echo "No changes to commit in $path"
  fi
'

echo "Done."