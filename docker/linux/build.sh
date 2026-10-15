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

if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is not on PATH" >&2
    exit 1
fi

if [[ $(id -u) -eq 0 ]]; then
    echo "error: run build.sh as a normal user, not root" >&2
    exit 1
fi

# Optional Steam bake-in. Default to the host's native or snap Steam root
# (the directory holding config/libraryfolders.vdf); otherwise use the empty
# stub so the Dockerfile's COPY is a harmless no-op. Override by exporting
# STEAM_PATH. Only Stardew Valley is staged: Vortex's Linux discovery needs
# config/libraryfolders.vdf and the game's appmanifest_*.acf, and the rest of
# the Steam root holds the Steam client and the account's login files.
STARDEW_APPID=413150
if [[ -z "${STEAM_PATH:-}" ]]; then
    for candidate in "${HOME}/.local/share/Steam" "${HOME}/snap/steam/common/.local/share/Steam"; do
        if [[ -f "${candidate}/config/libraryfolders.vdf" ]]; then
            STEAM_PATH="${candidate}"
            break
        fi
    done
fi
STEAM_CONTEXT="${SCRIPT_DIR}/steam-stub"
if [[ -f "${STEAM_PATH:-}/steamapps/appmanifest_${STARDEW_APPID}.acf" ]]; then
    STEAM_CONTEXT="${XDG_CACHE_HOME:-${HOME}/.cache}/vortex-qa/steam-context"
    rm -rf "${STEAM_CONTEXT}"
    mkdir -p "${STEAM_CONTEXT}/config" "${STEAM_CONTEXT}/steamapps/common"
    cp "${STEAM_PATH}/config/libraryfolders.vdf" "${STEAM_CONTEXT}/config/"
    cp "${STEAM_PATH}/steamapps/appmanifest_${STARDEW_APPID}.acf" "${STEAM_CONTEXT}/steamapps/"
    cp -al "${STEAM_PATH}/steamapps/common/Stardew Valley" "${STEAM_CONTEXT}/steamapps/common/" 2>/dev/null || {
        rm -rf "${STEAM_CONTEXT}/steamapps/common/Stardew Valley"
        cp -a "${STEAM_PATH}/steamapps/common/Stardew Valley" "${STEAM_CONTEXT}/steamapps/common/"
    }
fi
echo "Steam build context: ${STEAM_CONTEXT}"

exec docker buildx build \
    -f "${SCRIPT_DIR}/Dockerfile.vnc" \
    -t "${IMAGE}" \
    --build-context "steam=${STEAM_CONTEXT}" \
    --build-arg "USER_UID=$(id -u)" \
    --build-arg "USER_GID=$(id -g)" \
    --build-arg "NODE_VERSION=$(jq -r .engines.node "${REPO_ROOT}/package.json")" \
    "$@" \
    "${REPO_ROOT}"
