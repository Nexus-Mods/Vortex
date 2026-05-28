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

# Optional Steam bake-in. Default to the host's ~/.steam if it exists;
# otherwise use the empty stub so the Dockerfile's COPY is a harmless
# no-op. Override by exporting STEAM_PATH. The whole .steam tree is
# copied (not just steamapps/common) because Vortex's Linux discovery
# needs libraryfolders.vdf and the appmanifest_*.acf files to enumerate
# installed games.
DEFAULT_STEAM="${HOME}/.steam"
STEAM_PATH="${STEAM_PATH:-${DEFAULT_STEAM}}"
if [[ ! -d "${STEAM_PATH}" ]]; then
    STEAM_PATH="${SCRIPT_DIR}/steam-stub"
fi
echo "Steam build context: ${STEAM_PATH}"

exec docker buildx build \
    -f "${SCRIPT_DIR}/Dockerfile.vnc" \
    -t "${IMAGE}" \
    --build-context "steam=${STEAM_PATH}" \
    "$@" \
    "${REPO_ROOT}"
