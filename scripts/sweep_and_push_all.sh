#!/usr/bin/env bash
set -eo pipefail

# Force git submodule foreach to use bash
export SHELL=/bin/bash

# Sweep repo and all submodules: commit and push any untracked/modified changes
# With macOS-branch and fork safety checks.
#
# IMPORTANT: This script preserves existing submodule remote configurations
# to prevent unintended changes to remote URLs during push operations.
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

# Function to preserve current submodule remote configurations
preserve_submodule_remotes() {
  info "Preserving current submodule remote configurations..."
  
  # Save current remote configurations to prevent unintended changes
  if [[ -f "scripts/preserve_submodule_remotes.sh" ]]; then
    bash scripts/preserve_submodule_remotes.sh save
  else
    warn "Remote preservation script not found. Submodule remotes may be modified."
  fi
}

git_current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null
}

require_macos_branch_here() {
  local where="$1"  # label for logs
  local cur
  cur=$(git_current_branch)
  if [[ -z "$cur" || "$cur" == "HEAD" ]]; then
    warn "$where: Detached HEAD detected. Attempting to checkout appropriate macOS branch..."
    
    # Stash any untracked changes before branch operations
    local STASHED=0
    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
      info "$where: Stashing untracked changes before branch switch..."
      git stash push -u -m "auto-stash before macOS branch switch by sweep script $(date +%F_%T)" || true
      STASHED=1
    fi
    
    # Determine target branch - default to macos-experimental for superproject
    local target_branch="${MACOS_BRANCH:-macos-experimental}"
    
    # Try to checkout the target branch
    if git rev-parse --verify "$target_branch" >/dev/null 2>&1; then
      info "$where: Checking out existing branch $target_branch"
      git checkout "$target_branch" || {
        error "$where: Failed to checkout $target_branch. Please resolve manually."
        return 1
      }
      cur="$target_branch"
    else
      # Try to create the branch from current HEAD
      info "$where: Creating new branch $target_branch from current HEAD"
      git checkout -b "$target_branch" || {
        error "$where: Failed to create branch $target_branch. Please resolve manually."
        return 1
      }
      cur="$target_branch"
    fi
    
    # Pop stashed changes after successful branch switch
    if [ "$STASHED" = "1" ]; then
      info "$where: Restoring stashed changes after branch switch..."
      if ! git stash pop; then
        warn "$where: Conflicts while popping stash. Keeping stash for manual resolution."
        warn "$where: Use git stash list and git stash pop to resolve manually."
      else
        info "$where: Successfully restored stashed changes."
      fi
    fi
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
  local url="$1"
  local owner=""
  # Handle both SSH and HTTPS GitHub URLs
  if [[ "$url" =~ git@github\.com:([^/]+)/ ]]; then
    owner="${BASH_REMATCH[1]}"
  elif [[ "$url" =~ https://github\.com/([^/]+)/ ]]; then
    owner="${BASH_REMATCH[1]}"
  fi
  echo "$owner"
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

  local owner=""
  if [[ "$push_url" == git@github.com:* ]]; then
    local temp="${push_url#git@github.com:}"
    owner="${temp%%/*}"
  elif [[ "$push_url" == https://github.com/* ]]; then
    local temp="${push_url#https://github.com/}"
    owner="${temp%%/*}"
  fi
  
  if [[ -z "$owner" ]]; then
    warn "$where: Remote '$remote' does not point to GitHub. URL: $push_url"
    return 0  # Don't fail for non-GitHub remotes
  fi
  
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

# Print current status (superproject + submodules) before any changes
info "== Superproject: current status =="
sp_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
sp_upstream=$(git rev-parse --abbrev-ref "@{upstream}" 2>/dev/null || echo "")
sp_push_url=$(git remote get-url --push "$SUPER_REMOTE" 2>/dev/null || git remote get-url "$SUPER_REMOTE" 2>/dev/null || echo "")
printf "  branch: %s\n" "$sp_branch"
printf "  upstream: %s\n" "${sp_upstream:-<none>}"
printf "  %s push: %s\n" "$SUPER_REMOTE" "${sp_push_url:-<none>}"

info "== Submodules: current status =="
# shellcheck disable=SC2016
git submodule foreach --recursive '
  set +e
  nm="${name:-$path}"
  cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "HEAD")
  up=$(git rev-parse --abbrev-ref "@{upstream}" 2>/dev/null || echo "")
  push_url=$(git remote get-url --push ${REMOTE_NAME:-origin} 2>/dev/null || git remote get-url ${REMOTE_NAME:-origin} 2>/dev/null || echo "")
  fetch_url=$(git remote get-url ${REMOTE_NAME:-origin} 2>/dev/null || echo "")
  upstream_url=$(git remote get-url upstream 2>/dev/null || echo "")
  original_url=$(git remote get-url original 2>/dev/null || echo "")
  owner=""; repo=""
  case "$push_url" in
    git@github.com:*)
      temp=${push_url#git@github.com:}
      owner=${temp%%/*}; repo=${temp##*/}; repo=${repo%.git}
      ;;
    https://github.com/*)
      temp=${push_url#https://github.com/}
      owner=${temp%%/*}; repo=${temp##*/}; repo=${repo%.git}
      ;;
  esac
  echo "[status] $nm ($path)"
  echo "  branch: $cur"
  echo "  upstream: ${up:-<none>}"
  echo "  origin push: ${push_url:-<none>} (owner=${owner:-<unknown>}, repo=${repo:-<unknown>})"
  echo "  origin fetch: ${fetch_url:-<none>}"
  echo "  upstream remote: ${upstream_url:-<none>}"
  echo "  original remote: ${original_url:-<none>}"
  if [ -n "${FORK_USER:-}" ]; then
    if [ -n "$owner" ] && [ "$owner" != "$FORK_USER" ]; then
      echo "  EXPECTED OWNER: ${FORK_USER} (mismatch)"
    else
      echo "  EXPECTED OWNER: ${FORK_USER} (ok)"
    fi
  fi
  if [ -n "${MACOS_BRANCH:-}" ]; then
    if [ "$cur" != "$MACOS_BRANCH" ]; then
      echo "  EXPECTED BRANCH: ${MACOS_BRANCH} (mismatch)"
    else
      echo "  EXPECTED BRANCH: ${MACOS_BRANCH} (ok)"
    fi
  else
    shopt -s nocasematch
    if [[ "$cur" =~ macos ]]; then
      echo "  EXPECTED BRANCH: macos-* (ok)"
    else
      echo "  EXPECTED BRANCH: macos-* (mismatch)"
    fi
    shopt -u nocasematch
  fi
' || true

# Preserve current submodule remote configurations before any operations
preserve_submodule_remotes

# Auto-setup submodules to point to forks if needed
setup_submodules_to_forks() {
  info "Checking if submodules need to be pointed to forks..."
  
  # Check if any submodules are not pointing to the expected fork user
  local needs_setup=false
  
  # shellcheck disable=SC2016
  git submodule foreach --quiet '
    push_url=$(git remote get-url --push origin 2>/dev/null || git remote get-url origin 2>/dev/null || true)
    if [ -n "$push_url" ]; then
      owner=""
       if [[ "$push_url" == git@github.com:* ]]; then
         temp="${push_url#git@github.com:}"
         owner="${temp%%/*}"
       elif [[ "$push_url" == https://github.com/* ]]; then
         temp="${push_url#https://github.com/}"
         owner="${temp%%/*}"
       fi
      if [ -n "${FORK_USER:-}" ] && [ -n "$owner" ] && [ "$owner" != "$FORK_USER" ]; then
        echo "NEEDS_SETUP:$name:$owner:$FORK_USER"
      fi
    fi
  ' || true | grep -q "NEEDS_SETUP:" && needs_setup=true
  
  if [ "$needs_setup" = true ]; then
    info "Some submodules need to be pointed to forks. Running setup script..."
    if [[ -f "scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh" ]]; then
      # Set GH_USER to match FORK_USER for consistency
      export GH_USER="$FORK_USER"
      if [[ "$DRY_RUN" == "true" ]]; then
        info "[dry-run] Would run: bash scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh"
      else
        bash scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh || {
          warn "Fork setup script failed. Some submodules may have uncommitted changes."
          warn "Please commit or stash changes in submodules and run the script manually:"
          warn "  bash scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh"
          return 1
        }
      fi
    else
      error "Fork setup script not found. Please ensure scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh exists."
      return 1
    fi
  else
    info "All submodules already point to the correct forks."
  fi
}

# Ensure correct branch and remote ownership in superproject
require_macos_branch_here "superproject"
require_remote_targets_fork "$SUPER_REMOTE" "superproject"
ensure_branch_upstream_here "$SUPER_REMOTE" "superproject"

# Auto-setup submodules to point to forks if needed
setup_submodules_to_forks

info "== Submodules: sweep and push =="
# Iterate all submodules recursively, commit & push if they have changes
# shellcheck disable=SC2016
git submodule foreach --recursive '
  set -e
  set +u
  # Capture initial status; will refresh before committing
  st=$(git status --porcelain=v1 -uall)
  
  # Check branch name in each submodule and handle detached HEAD
  cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  STASHED=0
  SKIP_MERGE=0
  
  if [ -z "$cur" ] || [ "$cur" = "HEAD" ]; then
    echo "[warn] $name ($path): Detached HEAD detected. Attempting to checkout appropriate branch..."
    
    # Stash any untracked changes before branch operations
    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
      echo "[info] $name ($path): Stashing untracked changes before branch switch..."
      git stash push -u -m "auto-stash before macOS branch switch by sweep script $(date +%F_%T)" || true
      STASHED=1
    fi
    
    # Determine target branch based on submodule
    target_branch="macos-experimental"
    if [[ "$name" == "extensions/theme-switcher" || "$path" == *"extensions/theme-switcher"* ]]; then
      target_branch="macos-tahoe-theme"
    fi
    
    # Try to checkout the target branch
    if git rev-parse --verify "$target_branch" >/dev/null 2>&1; then
      echo "[info] $name ($path): Checking out existing branch $target_branch"
      git checkout "$target_branch" || {
        echo "[error] $name ($path): Failed to checkout $target_branch. Please resolve manually."
        exit 1
      }
      cur="$target_branch"
    else
      # Try to create the branch from current HEAD
      echo "[info] $name ($path): Creating new branch $target_branch from current HEAD"
      git checkout -b "$target_branch" || {
        echo "[error] $name ($path): Failed to create branch $target_branch. Please resolve manually."
        exit 1
      }
      cur="$target_branch"
    fi
    
    # Pop stashed changes after successful branch switch
    if [ "$STASHED" = "1" ]; then
      echo "[info] $name ($path): Restoring stashed changes after branch switch..."
      if ! git stash pop; then
        echo "[warn] $name ($path): Conflicts while popping stash. Keeping stash for manual resolution."
        echo "[warn] $name ($path): Use git stash list and git stash pop to resolve manually."
        # If conflicts exist, decide whether we can auto-resolve .DS_Store-only
        conflict_files=$(git ls-files -u | cut -f4 | sort -u)
        if [ -n "$conflict_files" ]; then
          only_dsstore=1
          for f in $conflict_files; do
            case "$f" in
              *.DS_Store) ;;
              *) only_dsstore=0; break ;;
            esac
          done
          if [ "$only_dsstore" -eq 1 ]; then
            echo "[info] $name ($path): Resolving .DS_Store conflicts by removing files"
            echo "$conflict_files" | xargs -r git rm -f --
            git commit -m "chore(git): remove conflicted .DS_Store after stash pop"
          else
            # Mark to skip remote merges and commits until user resolves
            SKIP_MERGE=1
          fi
        fi
      else
        echo "[info] $name ($path): Successfully restored stashed changes."
      fi
    fi
  fi
  case "${MACOS_BRANCH:-}" in
    "")
      shopt -s nocasematch
      if [[ ! "$cur" =~ macos ]]; then
        # Auto-switch attached submodule to default macOS branch
        target_branch="macos-experimental"
        if [[ "$name" == "extensions/theme-switcher" || "$path" == *"extensions/theme-switcher"* ]]; then
          target_branch="macos-tahoe-theme"
        fi
        if [ "${DRY_RUN:-false}" = "true" ]; then
          echo "[warn] $name ($path): Branch $cur is not macOS-*; [dry-run] Would stash and checkout $target_branch"
        else
          echo "[info] $name ($path): Switching from $cur to $target_branch"
          # Stash any untracked changes before branch operations
          STASHED=0
          if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
            echo "[info] $name ($path): Stashing changes before branch switch..."
            git stash push -u -m "auto-stash before macOS branch switch by sweep script $(date +%F_%T)" || true
            STASHED=1
          fi
          # Checkout or create target branch
          if git rev-parse --verify "$target_branch" >/dev/null 2>&1; then
            git checkout "$target_branch" || { echo "[error] $name ($path): Failed to checkout $target_branch"; exit 1; }
          else
            git checkout -b "$target_branch" || { echo "[error] $name ($path): Failed to create $target_branch"; exit 1; }
          fi
          cur="$target_branch"
          # Restore stashed changes
          if [ "$STASHED" = "1" ]; then
            echo "[info] $name ($path): Restoring stashed changes..."
            if ! git stash pop; then
              echo "[warn] $name ($path): Conflicts while popping stash; keeping stash for manual resolution."
              echo "[warn] $name ($path): Use git stash list/pop to resolve."
              conflict_files=$(git ls-files -u | cut -f4 | sort -u)
              if [ -n "$conflict_files" ]; then
                only_dsstore=1
                for f in $conflict_files; do
                  case "$f" in
                    *.DS_Store) ;;
                    *) only_dsstore=0; break ;;
                  esac
                done
                if [ "$only_dsstore" -eq 1 ]; then
                  echo "[info] $name ($path): Resolving .DS_Store conflicts by removing files"
                  echo "$conflict_files" | xargs -r git rm -f --
                  git commit -m "chore(git): remove conflicted .DS_Store after stash pop"
                else
                  SKIP_MERGE=1
                fi
              fi
            fi
          fi
        fi
      fi
      shopt -u nocasematch
      ;;
    *)
      if [ "$cur" != "$MACOS_BRANCH" ]; then
        # Auto-switch attached submodule to explicitly requested MACOS_BRANCH
        if [ "${DRY_RUN:-false}" = "true" ]; then
          echo "[warn] $name ($path): On $cur; [dry-run] Would stash and checkout $MACOS_BRANCH"
        else
          echo "[info] $name ($path): Switching from $cur to $MACOS_BRANCH"
          STASHED=0
          if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
            echo "[info] $name ($path): Stashing changes before branch switch..."
            git stash push -u -m "auto-stash before macOS branch switch by sweep script $(date +%F_%T)" || true
            STASHED=1
          fi
          if git rev-parse --verify "$MACOS_BRANCH" >/dev/null 2>&1; then
            git checkout "$MACOS_BRANCH" || { echo "[error] $name ($path): Failed to checkout $MACOS_BRANCH"; exit 1; }
          else
            git checkout -b "$MACOS_BRANCH" || { echo "[error] $name ($path): Failed to create $MACOS_BRANCH"; exit 1; }
          fi
          cur="$MACOS_BRANCH"
          if [ "$STASHED" = "1" ]; then
            echo "[info] $name ($path): Restoring stashed changes..."
            if ! git stash pop; then
              echo "[warn] $name ($path): Conflicts while popping stash; keeping stash for manual resolution."
              echo "[warn] $name ($path): Use git stash list/pop to resolve."
              conflict_files=$(git ls-files -u | cut -f4 | sort -u)
              if [ -n "$conflict_files" ]; then
                only_dsstore=1
                for f in $conflict_files; do
                  case "$f" in
                    *.DS_Store) ;;
                    *) only_dsstore=0; break ;;
                  esac
                done
                if [ "$only_dsstore" -eq 1 ]; then
                  echo "[info] $name ($path): Resolving .DS_Store conflicts by removing files"
                  echo "$conflict_files" | xargs -r git rm -f --
                  git commit -m "chore(git): remove conflicted .DS_Store after stash pop"
                else
                  SKIP_MERGE=1
                fi
              fi
            fi
          fi
        fi
      fi
      ;;
  esac
  # Validate remote owner
  push_url=$(git remote get-url --push $REMOTE_NAME 2>/dev/null || git remote get-url $REMOTE_NAME 2>/dev/null || true)
  if [ -z "$push_url" ]; then
    echo "[error] $name ($path): Remote $REMOTE_NAME missing."
    exit 1
  fi
  # Extract owner using parameter expansion for maximum compatibility
  owner=""
  case "$push_url" in
    git@github.com:*)
      temp=${push_url#git@github.com:}
      owner=${temp%%/*}
      ;;
    https://github.com/*)
      temp=${push_url#https://github.com/}
      owner=${temp%%/*}
      ;;
  esac
  if [ -z "$FORK_USER" ]; then
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[warn] $name ($path): FORK_USER not set; [dry-run] continuing without enforcement."
    else
      echo "[error] $name ($path): FORK_USER not set and cannot be inferred in submodules. Set FORK_USER."
      exit 1
    fi
  fi
  if [ "$owner" != "$FORK_USER" ]; then
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[warn] $name ($path): Remote $REMOTE_NAME points to owner $owner, expected $FORK_USER. [dry-run] Would re-point to fork. URL: $push_url"
    else
      echo "[error] $name ($path): Remote $REMOTE_NAME points to owner $owner, expected $FORK_USER. URL: $push_url"
      exit 1
    fi
  fi
  # Ensure upstream tracking is set to the selected remote
  up=$(git rev-parse --abbrev-ref "${cur}@{upstream}" 2>/dev/null || true)
  up_remote="${up%%/*}"
  if [ -z "$up_remote" ] || [ "$up_remote" != "${REMOTE_NAME}" ]; then
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[warn] $name ($path): Upstream for $cur is $up (expected remote ${REMOTE_NAME}). [dry-run] Not changing."
    else
      echo "[info] $name ($path): Setting upstream of $cur to ${REMOTE_NAME}/$cur"
      git branch --set-upstream-to "${REMOTE_NAME}/$cur" "$cur" 2>/dev/null || git push -u "${REMOTE_NAME}" "$cur" || true
    fi
  fi

  # Attempt to merge master from preferred remote into current branch
  # Preference order: original > upstream > REMOTE_NAME (origin)
  merge_remote=""
  if git remote get-url original >/dev/null 2>&1; then
    merge_remote="original"
  elif git remote get-url upstream >/dev/null 2>&1; then
    merge_remote="upstream"
  else
    merge_remote="${REMOTE_NAME}"
  fi
  # Fetch master from merge_remote
  if [ "${DRY_RUN:-false}" = "true" ]; then
    if [ "$SKIP_MERGE" -eq 1 ]; then
      echo "[info] $name ($path): [dry-run] Skipping remote merge due to unresolved conflicts"
    else
      echo "[info] $name ($path): [dry-run] Would fetch $merge_remote and merge $merge_remote/master into $cur"
    fi
  else
    if [ "$SKIP_MERGE" -eq 1 ]; then
      echo "[info] $name ($path): Skipping remote merge due to unresolved conflicts"
    else
    echo "[info] $name ($path): Fetching $merge_remote"
    (git fetch "$merge_remote" --prune || true)
    # Ensure remote has master
    if git ls-remote --heads "$merge_remote" master >/dev/null 2>&1; then
      # Ensure local master exists/tracks remote master
      if ! git show-ref --verify --quiet refs/heads/master; then
        git branch --track master "$merge_remote"/master 2>/dev/null || git fetch "$merge_remote" master:refs/heads/master || true
      fi
      echo "[info] $name ($path): Merging $merge_remote/master into $cur"
      if ! git merge --no-edit "$merge_remote"/master; then
        echo "[warn] $name ($path): Merge produced conflicts. Attempting auto-resolution."
        # Check for .DS_Store-only conflicts
        conflict_files=$(git ls-files -u | cut -f4 | sort -u)
        if [ -n "$conflict_files" ]; then
          only_dsstore=1
          for f in $conflict_files; do
            case "$f" in
              *.DS_Store) ;;
              *) only_dsstore=0; break ;;
            esac
          done
          if [ "$only_dsstore" -eq 1 ]; then
            echo "[info] $name ($path): Resolving .DS_Store conflicts by removing files"
            echo "$conflict_files" | xargs -r git rm -f --
            git commit -m "chore(git): remove conflicted .DS_Store after master merge"
          else
            # Optional global strategy via AUTO_MERGE_STRATEGY=ours|theirs
            if [ -n "${AUTO_MERGE_STRATEGY:-}" ]; then
              echo "[info] $name ($path): Retrying merge with strategy -X ${AUTO_MERGE_STRATEGY}"
              git merge --abort || true
              if ! git merge --no-edit -X "${AUTO_MERGE_STRATEGY}" "$merge_remote"/master; then
                echo "[error] $name ($path): Merge conflicts remain after strategy retry. Please resolve manually."
                exit 1
              fi
            else
              echo "[error] $name ($path): Non-.DS_Store merge conflicts detected. Set AUTO_MERGE_STRATEGY=ours|theirs to auto-resolve or resolve manually."
              exit 1
            fi
          fi
        else
          echo "[error] $name ($path): Merge failed without conflict details. Please resolve manually."
          exit 1
        fi
      fi
    else
      echo "[info] $name ($path): Remote ${merge_remote} has no master branch; skipping merge"
    fi
    fi
  fi

  # Refresh status to include changes from merges or conflict resolutions
  st=$(git status --porcelain=v1 -uall)
  if [ -n "$st" ]; then
    echo "Changes in $name ($path):"
    printf "%s\n" "$st"
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[dry-run] Skipping commit/push in $name"
    else
      # Guard against committing with unresolved conflicts
      conflict_files=$(git ls-files -u | cut -f4 | sort -u)
      if [ -n "$conflict_files" ]; then
        only_dsstore=1
        for f in $conflict_files; do
          case "$f" in
            *.DS_Store) ;;
            *) only_dsstore=0; break ;;
          esac
        done
        if [ "$only_dsstore" -eq 1 ]; then
          echo "[info] $name ($path): Resolving .DS_Store conflicts by removing files before commit"
          echo "$conflict_files" | xargs -r git rm -f --
          git commit -m "chore(git): remove conflicted .DS_Store before commit"
        else
          echo "[warn] $name ($path): Unresolved non-.DS_Store conflicts; skipping commit/push"
          exit 0
        fi
      fi
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
    # Still push in case merge created a commit without working tree changes
    if [ "${DRY_RUN:-false}" != "true" ]; then
      # Also avoid push when unresolved conflicts exist
      conflict_files=$(git ls-files -u | cut -f4 | sort -u)
      if [ -n "$conflict_files" ]; then
        echo "[warn] $name ($path): Unresolved conflicts present; skipping push"
        exit 0
      fi
      branch=$(git rev-parse --abbrev-ref HEAD)
      if [ "$branch" != "HEAD" ]; then
        echo "[info] $name ($path): Pushing $branch to ${REMOTE_NAME}"
        git push -u "${REMOTE_NAME}" "$branch" || git push "${REMOTE_NAME}" HEAD || true
      else
        echo "[info] $name ($path): Pushing HEAD to ${REMOTE_NAME}"
        git push "${REMOTE_NAME}" HEAD || true
      fi
    else
      echo "[dry-run] Would push current branch after merge if needed"
    fi
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
  # If there are unresolved conflicts at this point, optionally skip merge step
  conflict_files=$(git ls-files -u | cut -f4 | sort -u)
  if [ -n "$conflict_files" ]; then
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[warn] $name ($path): Unresolved conflicts present; [dry-run] Would skip merging master."
      SKIP_MERGE=1
    else
      only_dsstore=1
      for f in $conflict_files; do
        case "$f" in
          *.DS_Store) ;;
          *) only_dsstore=0; break ;;
        esac
      done
      if [ "$only_dsstore" -eq 1 ]; then
        echo "[info] $name ($path): Resolving .DS_Store conflicts by removing files"
        echo "$conflict_files" | xargs -r git rm -f --
        git commit -m "chore(git): remove conflicted .DS_Store before remote merge"
      else
        echo "[warn] $name ($path): Unresolved non-.DS_Store conflicts exist; skipping remote merge until resolved."
        SKIP_MERGE=1
      fi
    fi
  fi
