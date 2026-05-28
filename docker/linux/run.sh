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

CONTAINER="${CONTAINER_NAME:-vortex-vnc}"
IMAGE="${IMAGE_NAME:-vortex-vnc}"

if ! command -v docker >/dev/null 2>&1; then
    echo "error: docker is not on PATH" >&2
    exit 1
fi

if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
    echo "error: image '${IMAGE}' not found." >&2
    echo "       Build it first: docker build -f docker/linux/Dockerfile.vnc -t ${IMAGE} ." >&2
    exit 1
fi

# If a container with this name already exists, handle it. Use `docker
# container inspect` (exact name match) rather than `docker ps --filter`
# which uses a regex that older daemons handle inconsistently.
if docker container inspect "${CONTAINER}" >/dev/null 2>&1; then
    state="$(docker container inspect -f '{{.State.Status}}' "${CONTAINER}")"
    if [[ "${state}" == "running" ]]; then
        echo "Container '${CONTAINER}' is already running. Connect with:"
        echo "  docker/linux/connect.sh ${CONTAINER}"
        exit 0
    fi
    echo "Removing stopped container '${CONTAINER}' (state: ${state})..."
    docker rm "${CONTAINER}" >/dev/null
fi

id="$(docker run -d \
    --name "${CONTAINER}" \
    -p 5901:5901 \
    -p 6901:6901 \
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
