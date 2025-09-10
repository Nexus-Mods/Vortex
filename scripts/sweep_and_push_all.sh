#!/usr/bin/env bash
set -euo pipefail

# Sweep repo and all submodules: commit and push any untracked/modified changes
# With macOS-branch and fork safety checks.
#
# Usage:
#   ./scripts/sweep_and_push_all.sh [--dry-run]
#
# Environment variables:
#   DRY_RUN=true|false            Run without committing/pushing (also via --dry-run)
#   REMOTE_NAME=<name>            Remote to use for submodules (default: origin)
#   SUPER_REMOTE=<name>           Remote to use for superproject (default: REMOTE_NAME)
#   MACOS_BRANCH=<branch>         Expected branch name (checked in superproject & all submodules).
#                                 If unset, a branch containing 'macos' (case-insensitive) is required.
#   FORK_USER=<github-user>       Required owner for push URLs (superproject + submodules). The push URL
#                                 for the selected remote must contain github.com/<FORK_USER>/...
#                                 If unset, we try to infer from SUPER_REMOTE push URL in the superproject.

# Parse optional flag
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi
export DRY_RUN

REMOTE_NAME="${REMOTE_NAME:-origin}"
SUPER_REMOTE="${SUPER_REMOTE:-$REMOTE_NAME}"
MACOS_BRANCH="${MACOS_BRANCH:-}"
FORK_USER="${FORK_USER:-}"
# Export vars so they are available inside git submodule foreach shells
export REMOTE_NAME SUPER_REMOTE MACOS_BRANCH FORK_USER

info()  { printf "[info] %s\n" "$*"; }
warn()  { printf "[warn] %s\n" "$*"; }
error() { printf "[error] %s\n" "$*"; }

git_current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null
}

require_macos_branch_here() {
  local where="$1"  # label for logs
  local cur
  cur=$(git_current_branch)
  if [[ -z "$cur" || "$cur" == "HEAD" ]]; then
    error "$where: Detached HEAD. Please checkout a branch."
    return 1
  fi
  if [[ -n "$MACOS_BRANCH" ]]; then
    if [[ "$cur" != "$MACOS_BRANCH" ]]; then
      error "$where: Expected branch '$MACOS_BRANCH' but found '$cur'."
      return 1
    fi
  else
    shopt -s nocasematch
    if [[ ! "$cur" =~ macos ]]; then
      error "$where: Branch '$cur' does not look like a macOS branch. Set MACOS_BRANCH or checkout your macOS branch."
      return 1
    fi
    shopt -u nocasematch
  fi
}

extract_owner_from_url() {
  # Prints the GitHub owner extracted from a remote URL, or empty if not GitHub.
  local url="$1"
  local owner=""
  if [[ "$url" =~ github\.com[:/]+([^/]+)/ ]]; then
    owner="${BASH_REMATCH[1]}"
  fi
  printf "%s" "$owner"
}

require_remote_targets_fork() {
  # Args: <remote-name> <context-label>
  local remote="$1"; shift
  local where="$1"; shift || true

  local push_url
  if ! push_url=$(git remote get-url --push "$remote" 2>/dev/null); then
    push_url=$(git remote get-url "$remote" 2>/dev/null || true)
  fi
  if [[ -z "$push_url" ]]; then
    error "$where: Remote '$remote' not found or has no URL."
    return 1
  fi

  local owner
  owner=$(extract_owner_from_url "$push_url")
  if [[ -z "$FORK_USER" ]]; then
    # Try to infer FORK_USER once from SUPER_REMOTE in the superproject
    if [[ "$where" == "superproject" ]]; then
      if [[ -n "$owner" ]]; then
        FORK_USER="$owner"
        export FORK_USER
        info "Inferred FORK_USER='$FORK_USER' from $remote push URL."
      else
        error "superproject: Unable to infer FORK_USER from $remote push URL '$push_url'. Set FORK_USER explicitly."
        return 1
      fi
    else
      # In submodules FORK_USER must be set already
      error "$where: FORK_USER is not set and could not be inferred. Set FORK_USER to your GitHub username."
      return 1
    fi
  fi

  if [[ "$owner" != "$FORK_USER" ]]; then
    error "$where: Remote '$remote' push URL owner '$owner' does not match FORK_USER '$FORK_USER'."
    error "URL: $push_url"
    error "Fix example: git remote set-url --push $remote git@github.com:$FORK_USER/<repo>.git"
    return 1
  fi
}

ensure_branch_upstream_here() {
  # Args: <remote-name> <context-label>
  local remote="$1"; shift
  local where="$1"; shift || true
  local cur
  cur=$(git_current_branch)
  local up
  up=$(git rev-parse --abbrev-ref "${cur}@{upstream}" 2>/dev/null || true)
  local up_remote=""
  if [[ -n "$up" ]]; then
    up_remote=${up%%/*}
  fi
  if [[ -z "$up_remote" || "$up_remote" != "$remote" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      warn "$where: Upstream for '$cur' is '$up' (expected remote '$remote'). [dry-run] Not changing."
    else
      info "$where: Setting upstream of '$cur' to '$remote/$cur'"
      git branch --set-upstream-to "$remote/$cur" "$cur" 2>/dev/null || git push -u "$remote" "$cur" || true
    fi
  fi
}

info "== Superproject root: $(pwd) =="
info "Using remote '$REMOTE_NAME' for submodules and '$SUPER_REMOTE' for superproject pushes"

# Ensure correct branch and remote ownership in superproject
require_macos_branch_here "superproject"
require_remote_targets_fork "$SUPER_REMOTE" "superproject"
ensure_branch_upstream_here "$SUPER_REMOTE" "superproject"

info "== Submodules: sweep and push =="
# Iterate all submodules recursively, commit & push if they have changes
# shellcheck disable=SC2016
git submodule foreach --recursive '
  set -e
  st=$(git status --porcelain=v1 -uall)
  # Check branch name in each submodule
  cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ -z "$cur" ] || [ "$cur" = "HEAD" ]; then
    echo "[error] $name ($path): Detached HEAD. Please checkout your macOS branch."
    exit 1
  fi
  case "${MACOS_BRANCH:-}" in
    "")
      shopt -s nocasematch
      if [[ ! "$cur" =~ macos ]]; then
        echo "[error] $name ($path): Branch '$cur' does not look like a macOS branch. Set MACOS_BRANCH or checkout your macOS branch."
        exit 1
      fi
      shopt -u nocasematch
      ;;
    *)
      if [ "$cur" != "$MACOS_BRANCH" ]; then
        echo "[error] $name ($path): Expected branch '$MACOS_BRANCH' but found '$cur'."
        exit 1
      fi
      ;;
  esac
  # Validate remote owner
  push_url=$(git remote get-url --push "${REMOTE_NAME}" 2>/dev/null || git remote get-url "${REMOTE_NAME}" 2>/dev/null || true)
  if [ -z "$push_url" ]; then
    echo "[error] $name ($path): Remote '${REMOTE_NAME}' missing."
    exit 1
  fi
  owner=""
  if [[ "$push_url" =~ github\.com[:/]+([^/]+)/ ]]; then owner="${BASH_REMATCH[1]}"; fi
  if [ -z "${FORK_USER:-}" ]; then
    echo "[error] $name ($path): FORK_USER not set and cannot be inferred in submodules. Set FORK_USER."
    exit 1
  fi
  if [ "$owner" != "$FORK_USER" ]; then
    echo "[error] $name ($path): Remote '${REMOTE_NAME}' points to owner '$owner', expected '$FORK_USER'. URL: $push_url"
    exit 1
  fi
  # Ensure upstream tracking is set to the selected remote
  up=$(git rev-parse --abbrev-ref "${cur}@{upstream}" 2>/dev/null || true)
  up_remote="${up%%/*}"
  if [ -z "$up_remote" ] || [ "$up_remote" != "${REMOTE_NAME}" ]; then
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[warn] $name ($path): Upstream for '$cur' is '$up' (expected remote '${REMOTE_NAME}'). [dry-run] Not changing."
    else
      echo "[info] $name ($path): Setting upstream of '$cur' to '${REMOTE_NAME}/$cur'"
      git branch --set-upstream-to "${REMOTE_NAME}/$cur" "$cur" 2>/dev/null || git push -u "${REMOTE_NAME}" "$cur" || true
    fi
  fi

  if [ -n "$st" ]; then
    echo "Changes in $name ($path):"
    printf "%s\n" "$st"
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[dry-run] Skipping commit/push in $name"
    else
      git add -A
      branch=$(git rev-parse --abbrev-ref HEAD)
      git commit -m "chore($name): sweep and commit untracked changes" -m "$st" || echo "No commit created in $name"
      # Prefer pushing the current branch if not detached; otherwise push HEAD
      if [ "$branch" != "HEAD" ]; then
        git push -u "${REMOTE_NAME}" "$branch" || git push "${REMOTE_NAME}" HEAD || true
      else
        git push "${REMOTE_NAME}" HEAD || true
      fi
    fi
  else
    echo "No changes in $name ($path)"
  fi
'

info "== Detect submodule pointer updates in superproject =="
changed=$(git submodule foreach --quiet 'curr=$(git rev-parse HEAD); if [ "$sha1" != "$curr" ]; then echo "$path $sha1 $curr"; fi') || true
if [ -n "$changed" ]; then
  echo "$changed" | sed 's/^/ - /'
  subpaths=$(printf "%s\n" "$changed" | awk '{print $1}' | sort -u)
  if [ "$DRY_RUN" = "true" ]; then
    info "[dry-run] Would stage updated gitlinks for:" && printf "  %s\n" $subpaths
  else
    # shellcheck disable=SC2086
    git add $subpaths
    git commit -m "chore(submodules): update pointers to latest submodule commits" -m "$changed" || true
    git push "$SUPER_REMOTE" || true
  fi
else
  info "No submodule pointer updates needed"
fi

info "== Superproject: sweep and push =="
sp_status=$(git status --porcelain=v1 -uall)
if [ -n "$sp_status" ]; then
  printf "%s\n" "$sp_status"
  if [ "$DRY_RUN" = "true" ]; then
    info "[dry-run] Would commit and push superproject changes"
  else
    git add -A
    git commit -m "chore(repo): sweep and commit untracked changes" -m "$sp_status" || true
    git push "$SUPER_REMOTE" || true
  fi
else
  info "No changes in superproject"
fi

info "== Final summary =="
echo "Superproject HEAD:" && git log -1 --oneline || true
printf "\nSubmodule heads (compact):\n" && git submodule status || true