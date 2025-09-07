#!/usr/bin/env bash
set -euo pipefail

header() { printf "\n---- %s (%s) ----\n" "$1" "$2"; }

summarize_one() {
  local dir="$1"; local name="$2"
  if [ ! -d "$dir/.git" ] && [ ! -f "$dir/.git" ]; then
    header "$name" "$dir"
    echo "Submodule directory not initialized; skipping"
    return 0
  fi
  header "$name" "$dir"
  (
    cd "$dir"
    # Remotes
    echo "Remotes:"
    for r in origin upstream original; do
      if git remote get-url "$r" >/dev/null 2>&1; then
        url=$(git remote get-url "$r")
        echo "  $r: $url"
      fi
    done

    # Branch and tracking
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo HEAD)
    if [ "$branch" = "HEAD" ]; then branch="(detached)"; fi
    echo "Branch: $branch"
    upstream_ref=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
    compare_ref=""
    if [ -n "$upstream_ref" ]; then
      echo "Tracking: $upstream_ref"
      ahead=$(git rev-list --count "$upstream_ref"..HEAD 2>/dev/null || echo 0)
      behind=$(git rev-list --count HEAD.."$upstream_ref" 2>/dev/null || echo 0)
      echo "Ahead/Behind: ${ahead}/${behind}"
      compare_ref="$upstream_ref"
    else
      echo "Tracking: none"
      if [ "$branch" != "(detached)" ] && git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
        ahead=$(git rev-list --count "origin/$branch"..HEAD 2>/dev/null || echo 0)
        behind=$(git rev-list --count HEAD.."origin/$branch" 2>/dev/null || echo 0)
        echo "Ahead/Behind vs origin/$branch: ${ahead}/${behind}"
        compare_ref="origin/$branch"
      fi
    fi

    # Latest commit
    latest=$(git log -1 --pretty=format:"%h %s (%ci) by %an" 2>/dev/null || true)
    if [ -n "${latest:-}" ]; then
      echo "Latest: $latest"
    else
      echo "Latest: (none)"
    fi

    # Working tree status
    ws=$(git status --porcelain 2>/dev/null || true)
    if [ -n "$ws" ]; then
      ws_count=$(printf "%s" "$ws" | wc -l | tr -d " ")
      echo "Working tree: dirty (${ws_count} changes)"
      printf "%s\n" "$ws" | sed "s/^/  /"
    else
      echo "Working tree: clean"
    fi

    # Ahead details vs chosen compare ref
    if [ -n "$compare_ref" ]; then
      ahead_commits=$(git log --oneline --decorate --no-merges "$compare_ref"..HEAD 2>/dev/null | head -n 20 || true)
      if [ -n "${ahead_commits:-}" ]; then
        echo "Commits ahead of $compare_ref (max 20):"
        printf "%s\n" "$ahead_commits" | sed "s/^/  /"
        echo "Changed files vs $compare_ref:"
        git diff --name-status "$compare_ref"..HEAD 2>/dev/null | sed "s/^/  /" || true
      fi
      behind_commits=$(git log --oneline --decorate --no-merges HEAD.."$compare_ref" 2>/dev/null | head -n 10 || true)
      if [ -n "${behind_commits:-}" ]; then
        echo "Commits behind $compare_ref (max 10):"
        printf "%s\n" "$behind_commits" | sed "s/^/  /"
      fi
    fi
  )
}

main() {
  echo "===== Submodules Summary Report ====="
  echo "Repository: $(basename "$PWD")"
  echo "Top-level commit: $(git rev-parse --short HEAD)"
  echo

  if [ ! -f .gitmodules ]; then
    echo "No .gitmodules file found."
    exit 0
  fi

  any=0
  while IFS=$' ' read -r key spath; do
    any=1
    name=${key#submodule.}
    name=${name%.path}
    summarize_one "$spath" "$name"
  done < <(git config -f .gitmodules --get-regexp path || true)

  if [ "$any" = 0 ]; then
    echo "No submodules configured."
  fi
}

main "$@"