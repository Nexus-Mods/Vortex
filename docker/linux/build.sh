#!/usr/bin/env bash
# Build the Vortex VNC image.
#
# Usage:
#   docker/linux/build.sh                    # build with defaults
#   docker/linux/build.sh --no-cache         # extra args go to `docker build`
#
# Then start it with: docker/linux/run.sh
set -euo pipefail

IMAGE="${IMAGE_NAME:-vortex-vnc}"

# Resolve the repo root from this script's location so it works no matter
# where the user invokes it from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if ! command -v docker >/dev/null 2>&1; then
    echo "error: docker is not on PATH" >&2
    exit 1
fi

exec docker build \
    -f "${SCRIPT_DIR}/Dockerfile.vnc" \
    -t "${IMAGE}" \
    "$@" \
    "${REPO_ROOT}"
