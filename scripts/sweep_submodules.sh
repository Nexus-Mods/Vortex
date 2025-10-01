#!/usr/bin/env bash
set -euo pipefail

echo "Starting submodule sweep: fetch, align to master/main, and push."

# Ensure submodules are initialized and synced
GIT_EDITOR=true git submodule sync --recursive || true
GIT_EDITOR=true git submodule update --init --recursive || true

# Collect submodule paths from .gitmodules
SUBMODULES=$(git config -f .gitmodules --get-regexp '^submodule\..*\.path' | awk '{print $2}')

resolve_default_branch() {
  local remote="$1"
  local head
  if git ls-remote --heads "$remote" master | grep -q 'refs/heads/master'; then
    echo master; return
  fi
  if git ls-remote --heads "$remote" main | grep -q 'refs/heads/main'; then
    echo main; return
  fi
  head=$(git remote show "$remote" | sed -n '/HEAD branch/s/.*: //p' | head -n1 || true)
  if [ -n "$head" ]; then
    echo "$head"; return
  fi
  echo master
}

if [ -z "${SUBMODULES:-}" ]; then
  echo "No submodules found in .gitmodules; nothing to sweep."
else
  for sm in $SUBMODULES; do
    echo "\n—— Processing submodule: $sm ——"
    if [ ! -d "$sm/.git" ]; then
      echo "Initializing submodule $sm"
      GIT_EDITOR=true git submodule update --init "$sm"
    fi
    (
      cd "$sm"
      git fetch --all --prune
      # Prefer 'upstream' if present, otherwise 'origin'
      if git remote | grep -q '^upstream$'; then REMOTE=upstream; else REMOTE=origin; fi
      TARGET_BRANCH=$(resolve_default_branch "$REMOTE")
      echo "Remote: $REMOTE | Target branch: $TARGET_BRANCH"
      # Checkout local tracking branch at remote
      if git show-ref --verify --quiet refs/heads/"$TARGET_BRANCH"; then
        GIT_EDITOR=true git checkout "$TARGET_BRANCH"
      else
        GIT_EDITOR=true git checkout -B "$TARGET_BRANCH" "$REMOTE/$TARGET_BRANCH"
      fi
      # Fast-forward or hard reset to remote if divergent
      if GIT_EDITOR=true git merge --ff-only "$REMOTE/$TARGET_BRANCH"; then
        echo "Fast-forwarded $sm to $REMOTE/$TARGET_BRANCH"
      else
        echo "Non-FF merge; resetting $sm to $REMOTE/$TARGET_BRANCH"
        GIT_EDITOR=true git reset --hard "$REMOTE/$TARGET_BRANCH"
      fi
      # Ensure branch tracks remote
      GIT_EDITOR=true git branch --set-upstream-to="$REMOTE/$TARGET_BRANCH" "$TARGET_BRANCH" || true
      # Push if local ahead of remote
      AHEAD=$(git rev-list --left-right --count "$TARGET_BRANCH...$REMOTE/$TARGET_BRANCH" 2>/dev/null | awk '{print $1}')
      if [ "${AHEAD:-0}" -gt 0 ]; then
        echo "Local ahead by $AHEAD; pushing $sm to $REMOTE/$TARGET_BRANCH"
        GIT_EDITOR=true git push "$REMOTE" "$TARGET_BRANCH"
      else
        echo "No local commits to push for $sm"
      fi
    )
    # Record updated pointer in superproject
    GIT_EDITOR=true git add "$sm"
  done
fi

# Commit pointer updates in superproject if any
if ! git diff --cached --quiet; then
  GIT_EDITOR=true git commit -m "chore(submodules): sweep to latest master/main across submodules"
else
  echo "No pointer changes in superproject; nothing to commit."
fi

# Push superproject to origin
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ -n "$CURRENT_BRANCH" ]; then
  echo "Pushing superproject branch $CURRENT_BRANCH to origin"
  GIT_EDITOR=true git push --set-upstream origin "$CURRENT_BRANCH"
else
  echo "Detached HEAD; skipping superproject push."
fi

echo "Sweep complete."