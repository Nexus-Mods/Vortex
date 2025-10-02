#!/usr/bin/env bash
set -euo pipefail

# Consolidated submodule sweep script
# - Sync/init submodules
# - Prefer remote 'erik' as upstream; create it if missing (GitHub rewrite)
# - Resolve default branch (master/main/remote HEAD)
# - Checkout local branch tracking upstream and fast-forward/reset to upstream
# - Push if local ahead; record pointer updates in superproject and push
# - Clean .DS_Store files in submodules

echo "Starting consolidated submodule sweep using 'erik' as upstream."

root_dir=$(pwd)
GIT_EDITOR=true git submodule sync --recursive || true
GIT_EDITOR=true git submodule update --init --recursive || true

# Gather submodules from .gitmodules
SUBMODULES=$(git config -f .gitmodules --get-regexp '^submodule\..*\.path' | awk '{print $2}')

resolve_default_branch() {
  local remote="$1"
  # Try master, main, else remote HEAD
  if git ls-remote --heads "$remote" master | grep -q 'refs/heads/master'; then echo master; return; fi
  if git ls-remote --heads "$remote" main | grep -q 'refs/heads/main'; then echo main; return; fi
  local head_branch
  head_branch=$(git remote show "$remote" | sed -n '/HEAD branch/s/.*: //p' | head -n1 || true)
  if [ -n "$head_branch" ]; then echo "$head_branch"; else echo master; fi
}

ensure_erik_remote() {
  local current_remote_url
  current_remote_url=$(git remote get-url origin 2>/dev/null || git remote get-url upstream 2>/dev/null || true)
  if git remote | grep -q '^erik$'; then
    return 0
  fi
  # Attempt to derive ErikVeland fork URL from origin/upstream Github URL
  if [[ -n "$current_remote_url" && "$current_remote_url" =~ github.com ]]; then
    # Normalize to https URL for adding remote if SSH not desired
    local repo_name
    repo_name=$(basename "$current_remote_url" .git)
    # Prefer detected repo name; fall back to parsed path
    local erik_url
    erik_url="https://github.com/ErikVeland/${repo_name}.git"
    GIT_EDITOR=true git remote add erik "$erik_url" || true
  fi
}

if [ -z "${SUBMODULES:-}" ]; then
  echo "No submodules found in .gitmodules; nothing to sweep."
else
  for sm in $SUBMODULES; do
    echo "\n—— Processing submodule: $sm ——"
    [ -d "$sm" ] || { echo "Missing submodule directory: $sm"; continue; }
    (
      cd "$sm"
      # Clean .DS_Store
      find . -name '.DS_Store' -delete || true
      # Fetch all remotes
      GIT_EDITOR=true git fetch --all --prune || true
      # Ensure 'erik' remote exists or add derived one
      ensure_erik_remote
      # Choose upstream remote: prefer 'erik', else 'upstream', else 'origin'
      local REMOTE
      if git remote | grep -q '^erik$'; then REMOTE=erik;
      elif git remote | grep -q '^upstream$'; then REMOTE=upstream;
      else REMOTE=origin; fi
      local TARGET_BRANCH
      TARGET_BRANCH=$(resolve_default_branch "$REMOTE")
      echo "Remote: $REMOTE | Target branch: $TARGET_BRANCH"
      # Checkout local branch tracking remote
      if git show-ref --verify --quiet refs/heads/"$TARGET_BRANCH"; then
        GIT_EDITOR=true git checkout "$TARGET_BRANCH"
      else
        GIT_EDITOR=true git checkout -B "$TARGET_BRANCH" "$REMOTE/$TARGET_BRANCH"
      fi
      # Fast-forward or reset to upstream
      if GIT_EDITOR=true git merge --ff-only "$REMOTE/$TARGET_BRANCH"; then
        echo "Fast-forwarded $sm to $REMOTE/$TARGET_BRANCH"
      else
        echo "Non-FF; resetting $sm to $REMOTE/$TARGET_BRANCH"
        GIT_EDITOR=true git reset --hard "$REMOTE/$TARGET_BRANCH"
      fi
      # Ensure tracking is set
      GIT_EDITOR=true git branch --set-upstream-to="$REMOTE/$TARGET_BRANCH" "$TARGET_BRANCH" || true
      # Push if local ahead
      local AHEAD BEHIND
      read -r AHEAD BEHIND < <(git rev-list --left-right --count "$TARGET_BRANCH...$REMOTE/$TARGET_BRANCH" 2>/dev/null | awk '{print $1, $2}')
      if [ "${AHEAD:-0}" -gt 0 ]; then
        echo "Local ahead by $AHEAD; pushing $sm to $REMOTE/$TARGET_BRANCH"
        GIT_EDITOR=true git push "$REMOTE" "$TARGET_BRANCH" || true
      else
        echo "No local commits to push for $sm"
      fi
    )
    # Record updated pointer in superproject index
    GIT_EDITOR=true git add "$sm"
  done
fi

# Commit pointer updates
if ! git diff --cached --quiet; then
  GIT_EDITOR=true git commit -m "chore(submodules): consolidated sweep to latest on 'erik' upstream"
else
  echo "No pointer changes in superproject; nothing to commit."
fi

# Push superproject branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ]; then
  echo "Pushing superproject branch $CURRENT_BRANCH to origin"
  GIT_EDITOR=true git push --set-upstream origin "$CURRENT_BRANCH" || true
else
  echo "Detached HEAD; skipping superproject push."
fi

echo "Sweep complete."