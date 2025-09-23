#!/usr/bin/env bash
set -euo pipefail

# Setup submodules to point to user forks during postinstall
# This script is designed to be safe and non-destructive

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Default GitHub user - can be overridden by environment variable
GH_USER="${GH_USER:-ErikVeland}"

info() { printf "[setup-forks] %s\n" "$*"; }
warn() { printf "[setup-forks] WARN: %s\n" "$*"; }
error() { printf "[setup-forks] ERROR: %s\n" "$*"; }

# Check if we're in a git repository
if [[ ! -d ".git" ]]; then
  info "Not in a git repository, skipping submodule fork setup"
  exit 0
fi

# Check if we have submodules
if [[ ! -f ".gitmodules" ]]; then
  info "No .gitmodules file found, skipping submodule fork setup"
  exit 0
fi

# Check if submodules are initialized
if ! git submodule status >/dev/null 2>&1; then
  info "Submodules not initialized, skipping fork setup"
  exit 0
fi

info "Setting up submodules to point to $GH_USER forks..."

# Check if any submodules need fork setup
needs_setup=false

# shellcheck disable=SC2016
git submodule foreach --quiet '
  push_url=$(git remote get-url --push origin 2>/dev/null || git remote get-url origin 2>/dev/null || true)
  if [ -n "$push_url" ]; then
    owner=""
    if [[ "$push_url" =~ github\.com[:/]+([^/]+)/ ]]; then 
      owner="${BASH_REMATCH[1]}"
    fi
    if [ -n "$owner" ] && [ "$owner" != "'"$GH_USER"'" ]; then
      echo "NEEDS_SETUP:$name:$owner"
    fi
  fi
' | grep -q "NEEDS_SETUP:" && needs_setup=true

if [ "$needs_setup" = false ]; then
  info "All submodules already point to $GH_USER forks or are not GitHub repositories"
  exit 0
fi

# Check if the main fork setup script exists
FORK_SCRIPT="$ROOT_DIR/scripts/point_submodules_to_user_forks_and_ignore_dsstore.sh"
if [[ ! -f "$FORK_SCRIPT" ]]; then
  warn "Fork setup script not found at $FORK_SCRIPT"
  warn "Submodules may not be properly configured for your forks"
  exit 0
fi

# Check if we have any uncommitted changes in submodules that might interfere
has_uncommitted=false
# shellcheck disable=SC2016
git submodule foreach --quiet '
  if [ -n "$(git status --porcelain)" ]; then
    echo "UNCOMMITTED:$name"
  fi
' | grep -q "UNCOMMITTED:" && has_uncommitted=true

if [ "$has_uncommitted" = true ]; then
  warn "Some submodules have uncommitted changes. Skipping automatic fork setup."
  warn "Please commit or stash changes and run manually:"
  warn "  export GH_USER=$GH_USER && bash $FORK_SCRIPT"
  exit 0
fi

# Run the fork setup script
info "Running fork setup script..."
export GH_USER
if bash "$FORK_SCRIPT"; then
  info "Successfully configured submodules to point to $GH_USER forks"
else
  warn "Fork setup script failed. You may need to run it manually:"
  warn "  export GH_USER=$GH_USER && bash $FORK_SCRIPT"
fi