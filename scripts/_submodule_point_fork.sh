#!/usr/bin/env bash
set -euo pipefail

# Per-submodule helper invoked by point_submodules_to_user_forks_and_ignore_dsstore.sh
# Runs inside each submodule's working directory.

SUB_PATH="${PWD}"
SUB_NAME="${name:-$SUB_PATH}"

GH_USER="${GH_USER:-ErikVeland}"

echo -e "\n=== $SUB_NAME ==="

# Resolve remote URLs
origin_url=$(git remote get-url origin 2>/dev/null || true)
if [[ -z "$origin_url" ]]; then
  echo "No origin remote; skipping"
  exit 0
fi

# Detect protocol and extract owner/repo
proto=""
owner_repo=""
case "$origin_url" in
  git@github.com:*)
    proto="ssh"
    owner_repo="${origin_url#git@github.com:}"
    owner_repo="${owner_repo%.git}"
    ;;
  https://github.com/*)
    proto="https"
    owner_repo="${origin_url#https://github.com/}"
    owner_repo="${owner_repo%.git}"
    ;;
  *)
    echo "Unknown origin format: $origin_url; skipping"
    exit 0
    ;;
esac

owner="${owner_repo%%/*}"
repo="${owner_repo##*/}"

# Build URLs in same protocol
if [[ "$proto" == "ssh" ]]; then
  fork_url="git@github.com:${GH_USER}/${repo}.git"
  main_url="git@github.com:${owner}/${repo}.git"
else
  fork_url="https://github.com/${GH_USER}/${repo}.git"
  main_url="https://github.com/${owner}/${repo}.git"
fi

# Track whether we can push (i.e., a fork exists and origin points to it)
CAN_PUSH=1

# Ensure upstream/origin configuration
if [[ "$owner" != "$GH_USER" ]]; then
  # Check if fork exists before switching origin/upstream
  if git ls-remote --heads "$fork_url" >/dev/null 2>&1; then
    echo "Setting origin to $fork_url"
    git remote set-url origin "$fork_url"
    if git remote get-url upstream >/dev/null 2>&1; then
      git remote set-url upstream "$fork_url"
    else
      git remote add upstream "$fork_url"
    fi
    if git remote get-url original >/dev/null 2>&1; then
      git remote set-url original "$main_url"
    else
      git remote add original "$main_url"
    fi
  else
    echo "Fork not found for ${repo} under ${GH_USER}; preserving origin ($origin_url) and recording original remote ($main_url)"
    # Ensure 'original' remote is present and points to main
    if git remote get-url original >/dev/null 2>&1; then
      git remote set-url original "$main_url"
    else
      git remote add original "$main_url"
    fi
    # Ensure 'upstream' points to the currently reachable origin
    if git remote get-url upstream >/dev/null 2>&1; then
      git remote set-url upstream "$origin_url"
    else
      git remote add upstream "$origin_url"
    fi
    CAN_PUSH=0
  fi
else
  echo "Origin already points to user fork ($origin_url)"
  # Force upstream to user's fork
  if git remote get-url upstream >/dev/null 2>&1; then
    git remote set-url upstream "$fork_url"
  else
    git remote add upstream "$fork_url"
  fi
  # If the fork remote is not reachable, fall back to 'original' (if available)
  if ! git ls-remote --heads "$origin_url" >/dev/null 2>&1; then
    orig_main=$(git remote get-url original 2>/dev/null || true)
    if [[ -n "$orig_main" ]]; then
      echo "Fork remote not reachable; switching origin/upstream to original ($orig_main)"
      git remote set-url origin "$orig_main"
      if git remote get-url upstream >/dev/null 2>&1; then
        git remote set-url upstream "$orig_main"
      else
        git remote add upstream "$orig_main"
      fi
      CAN_PUSH=0
    else
      echo "Fork remote not reachable and no 'original' remote configured; keeping origin but skipping push"
      CAN_PUSH=0
    fi
  fi
fi

# Fetch remotes (ignore failures)
(git fetch origin --prune || true)
(git fetch upstream --prune || true)

# Determine target branch
TARGET_BRANCH="macos-experimental"
if [[ "$SUB_NAME" == "extensions/theme-switcher" || "$SUB_PATH" == *"extensions/theme-switcher"* ]]; then
  TARGET_BRANCH="macos-tahoe-theme"
fi

# Ensure we are on a branch (not detached)
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
if [[ "$current_branch" == "HEAD" ]]; then
  if git rev-parse --verify "$TARGET_BRANCH" >/dev/null 2>&1; then
    git checkout "$TARGET_BRANCH"
  else
    git checkout -b "$TARGET_BRANCH"
  fi
else
  if [[ "$current_branch" != "$TARGET_BRANCH" ]]; then
    if git rev-parse --verify "$TARGET_BRANCH" >/dev/null 2>&1; then
      git checkout "$TARGET_BRANCH"
    else
      echo "Staying on current branch '$current_branch' (no $TARGET_BRANCH)"
    fi
  fi
fi

# Attempt to auto-resolve .DS_Store-only conflicts
if [[ -n "$(git ls-files -u)" ]]; then
  conflict_files=$(git ls-files -u | awk '{print $4}' | sort -u)
  only_dsstore=1
  for f in $conflict_files; do
    if [[ "$f" != *.DS_Store ]]; then
      only_dsstore=0; break
    fi
  done
  if [[ $only_dsstore -eq 1 ]]; then
    echo "Resolving .DS_Store conflicts by removing files"
    echo "$conflict_files" | xargs -r git rm -f --
    git commit -m "chore(git): remove conflicted .DS_Store"
  else
    echo "Non-.DS_Store conflicts present; skipping .gitignore changes for $SUB_NAME"
    exit 0
  fi
fi

# Ensure .DS_Store is in .gitignore
if [[ -f .gitignore ]]; then
  if ! grep -qxF ".DS_Store" .gitignore; then
    echo ".DS_Store" >> .gitignore
    git add .gitignore
  fi
else
  echo ".DS_Store" > .gitignore
  git add .gitignore
fi

# Untrack any tracked ignored files (use -z directly to xargs to preserve separators)
git ls-files -z -i -c --exclude-standard | xargs -0 -r git rm --cached -f -- || true

# Commit if needed
if ! git diff --cached --quiet || ! git diff --quiet; then
  git commit -m "chore(git): ignore .DS_Store (macOS) and untrack existing files"
fi

# Push and set upstream to the fork (only if available)
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "${CAN_PUSH:-1}" -eq 1 ]]; then
  if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
    git push origin "$branch" || true
  else
    git push -u origin "$branch" || true
  fi
else
  echo "Skipping push for $SUB_NAME (no accessible fork remote)"
fi