#!/usr/bin/env bash
set -euo pipefail

# Configure all submodules to push to the user's forks and not the upstream org.
# Also ensure .DS_Store is ignored, untracked, committed, and pushed.
# Assumptions:
# - All submodules have already been forked under the GitHub user below.
# - You have push permissions to those forks.

GH_USER="ErikVeland"  # Change if needed
export GH_USER

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure helper exists and is executable
HELPER="$ROOT_DIR/scripts/_submodule_point_fork.sh"
if [[ ! -f "$HELPER" ]]; then
  echo "Missing helper: $HELPER" >&2
  exit 1
fi
chmod +x "$HELPER"

echo "Repointing submodule origins to forks under $GH_USER and committing .DS_Store ignores..."

git submodule foreach --recursive 'bash "$toplevel/scripts/_submodule_point_fork.sh"'

echo "Done."