#!/usr/bin/env bash
set -euo pipefail

# Sweep repo and all submodules: commit and push any untracked/modified changes
# Usage:
#   ./scripts/sweep_and_push_all.sh [--dry-run]
#
# - Commits and pushes changes inside each submodule to its current branch
# - Updates submodule pointers in the superproject if submodule HEADs moved
# - Commits and pushes superproject changes (including non-submodule files)

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi
export DRY_RUN

info()  { printf "[info] %s\n" "$*"; }
warn()  { printf "[warn] %s\n" "$*"; }
error() { printf "[error] %s\n" "$*"; }

info "== Superproject root: $(pwd) =="

info "== Submodules: sweep and push =="
# Iterate all submodules recursively, commit & push if they have changes
git submodule foreach --recursive '
  set -e
  st=$(git status --porcelain=v1 -uall)
  if [ -n "$st" ]; then
    echo "Changes in $name ($path):"
    printf "%s\n" "$st"
    if [ "${DRY_RUN:-false}" = "true" ]; then
      echo "[dry-run] Skipping commit/push in $name"
    else
      git add -A
      branch=$(git rev-parse --abbrev-ref HEAD)
      git commit -m "chore($name): sweep and commit untracked changes" -m "$st" || echo "No commit created in $name"
      git push -u origin "$branch" || git push origin HEAD || true
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
    git push || true
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
    git push || true
  fi
else
  info "No changes in superproject"
fi

info "== Final summary =="
echo "Superproject HEAD:" && git log -1 --oneline || true
printf "\nSubmodule heads (compact):\n" && git submodule status || true