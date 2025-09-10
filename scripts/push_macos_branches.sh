#!/usr/bin/env bash
set -euo pipefail

# Navigate to repo root regardless of where this script is invoked
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

log "[MAIN] Fetching remotes..."
git fetch --all --tags --prune

log "[MAIN] Evaluating local branches containing 'macos'..."
for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
  case "$b" in
    *macos*|*MacOS*)
      up=$(git rev-parse --abbrev-ref "$b@{upstream}" 2>/dev/null || true)
      if [ -z "$up" ]; then
        log "[MAIN] No upstream for $b -> pushing and setting upstream to origin/$b"
        git push -u origin "$b" || true
      else
        if cnts=$(git rev-list --left-right --count "$up"..."$b" 2>/dev/null); then
          set -- $cnts
          behind=${1:-0}; ahead=${2:-0}
          case "$ahead" in (''|*[!0-9]*) ahead=0;; esac
          if [ "$ahead" -gt 0 ]; then
            log "[MAIN] Branch $b is ahead of $up by $ahead commit(s) -> pushing"
            git push origin "$b" || true
          else
            log "[MAIN] Branch $b is up-to-date with $up (behind by ${behind:-0})"
          fi
        else
          log "[MAIN] Could not compare $b with $up, attempting push"
          git push origin "$b" || true
        fi
      fi
      ;;
  esac
done

log "[SUBMODULES] Processing submodules..."
# shellcheck disable=SC2016
git submodule foreach --recursive '
  set -e
  name=${name:-$path}
  echo "[SUB:$name] Fetching remotes..."
  git fetch --all --tags --prune || true
  echo "[SUB:$name] Evaluating local branches containing macos..."
  for b in $(git for-each-ref --format="%(refname:short)" refs/heads); do
    case "$b" in
      *macos*|*MacOS*)
        up=$(git rev-parse --abbrev-ref "$b@{upstream}" 2>/dev/null || true)
        if [ -z "$up" ]; then
          echo "[SUB:$name] No upstream for $b -> pushing and setting upstream to origin/$b"
          git push -u origin "$b" || true
        else
          if cnts=$(git rev-list --left-right --count "$up"..."$b" 2>/dev/null); then
            set -- $cnts
            behind=${1:-0}; ahead=${2:-0}
            case "$ahead" in (''|*[!0-9]*) ahead=0;; esac
            if [ "${ahead:-0}" -gt 0 ]; then
              echo "[SUB:$name] Branch $b is ahead of $up by $ahead commit(s) -> pushing"
              git push origin "$b" || true
            else
              echo "[SUB:$name] Branch $b is up-to-date with $up"
            fi
          else
            echo "[SUB:$name] Could not compare $b with $up, attempting push"
            git push origin "$b" || true
          fi
        fi
        ;;
    esac
  done
'