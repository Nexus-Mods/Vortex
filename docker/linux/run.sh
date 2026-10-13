#!/usr/bin/env bash
# Start the Vortex VNC container detached and ready for connect.sh.
#
# Usage:
#   docker/linux/run.sh                       # start with defaults
#   docker/linux/run.sh -e VNC_PASSWORD=...   # extra args go to `docker run`
#
# After this script exits, connect with:
#   docker/linux/connect.sh
set -euo pipefail

CONTAINER="vortex-vnc"
IMAGE="${IMAGE_NAME:-vortex-vnc}"

if ! command -v docker >/dev/null 2>&1; then
    echo "error: docker is not on PATH" >&2
    exit 1
fi

if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
    echo "error: image '${IMAGE}' not found." >&2
    echo "       Build it first: docker/linux/build.sh" >&2
    exit 1
fi

# If a container with this name already exists, stop and remove it so the
# run always produces a fresh container. Use `docker container inspect`
# (exact name match) rather than `docker ps --filter` which uses a regex
# that older daemons handle inconsistently.
if docker container inspect "${CONTAINER}" >/dev/null 2>&1; then
    state="$(docker container inspect -f '{{.State.Status}}' "${CONTAINER}")"
    if [[ "${state}" == "running" ]]; then
        echo "Stopping running container '${CONTAINER}'..."
        docker stop "${CONTAINER}" >/dev/null
    fi
    echo "Removing existing container '${CONTAINER}' (state was: ${state})..."
    docker rm "${CONTAINER}" >/dev/null
fi

# Keep Chrome's profile on the host so the Nexus Mods website login (and its
# Cloudflare check) survives fresh containers. build.sh gives the container's
# vortex user the host user's uid, so the container can write to it.
CHROME_PROFILE_DIR="${CHROME_PROFILE_DIR:-${HOME}/.cache/vortex-qa/chrome-profile}"
mkdir -p "${CHROME_PROFILE_DIR}" && chmod 700 "${CHROME_PROFILE_DIR}"
# A container killed mid-run leaves Chrome's lock behind, and the next container
# (different hostname) would refuse to open the profile. Only one container
# uses it at a time, so the locks are always stale here.
rm -f "${CHROME_PROFILE_DIR}"/SingletonLock "${CHROME_PROFILE_DIR}"/SingletonCookie "${CHROME_PROFILE_DIR}"/SingletonSocket

id="$(docker run -d \
    --name "${CONTAINER}" \
    -p 127.0.0.1:5901:5901 \
    -p 127.0.0.1:6901:6901 \
    -p 127.0.0.1:9222:9322 \
    -p 127.0.0.1:9223:9323 \
    --shm-size=2g \
    -v "${CHROME_PROFILE_DIR}:/home/vortex/chrome-profile" \
    "$@" \
    "${IMAGE}")"

echo "Started ${CONTAINER} (${id:0:12})."
echo "Connect with: docker/linux/connect.sh ${CONTAINER}"
echo "Stop with   : docker stop ${CONTAINER}"
echo
echo "Tailing logs (Ctrl+C detaches; the container keeps running)..."
echo

# Trap SIGINT so Ctrl+C just stops the log tail; the container stays up so
# the user can still connect.
trap 'echo; echo "Detached. Container still running."; exit 0' INT
exec docker logs -f "${CONTAINER}"
