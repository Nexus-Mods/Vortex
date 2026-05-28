#!/usr/bin/env bash
# Connect to the Vortex VNC container with a native VNC viewer.
#
# Usage:
#   docker/linux/connect.sh                 # default container name "vortex-vnc"
#   docker/linux/connect.sh <container>     # connect to a specific container
#
# Behaviour:
#   - Resolves the host-side port the container exposes for 5901/tcp.
#   - If no VNC_PASSWORD was passed at `docker run` time, fishes the
#     auto-generated password out of the container logs.
#   - Launches the first available VNC viewer on PATH and connects to
#     localhost:<port>. The password is printed so it can be pasted into
#     the viewer's prompt.
set -euo pipefail

CONTAINER="${1:-vortex-vnc}"

if ! command -v docker >/dev/null 2>&1; then
    echo "error: docker is not on PATH" >&2
    exit 1
fi

if ! docker container inspect "${CONTAINER}" >/dev/null 2>&1; then
    echo "error: container '${CONTAINER}' not found." >&2
    echo "       Start it with: docker run --rm -it -p 5901:5901 -p 6901:6901 --name ${CONTAINER} vortex-vnc" >&2
    exit 1
fi

state="$(docker container inspect -f '{{.State.Status}}' "${CONTAINER}")"
if [[ "${state}" != "running" ]]; then
    echo "error: container '${CONTAINER}' is not running (state: ${state})." >&2
    exit 1
fi

# `docker port` prints e.g. "0.0.0.0:5901".
mapping="$(docker port "${CONTAINER}" 5901/tcp 2>/dev/null | head -n1 || true)"
if [[ -z "${mapping}" ]]; then
    echo "error: container '${CONTAINER}' does not publish 5901/tcp." >&2
    echo "       Re-run with: -p 5901:5901" >&2
    exit 1
fi
VNC_PORT="${mapping##*:}"

# Find a VNC viewer. xtigervncviewer is preferred (matches the server) but
# any of these will work.
VIEWER=""
for candidate in xtigervncviewer vncviewer tigervnc realvnc-vncviewer remmina; do
    if command -v "${candidate}" >/dev/null 2>&1; then
        VIEWER="${candidate}"
        break
    fi
done

if [[ -z "${VIEWER}" ]]; then
    echo "error: no VNC viewer found on PATH." >&2
    echo "       Install one of: tigervnc-viewer, remmina, realvnc-vncviewer." >&2
    echo "       On Debian/Ubuntu: sudo apt install tigervnc-viewer" >&2
    exit 1
fi

# Pull the obfuscated VNC password file out of the container. TigerVNC's
# viewer accepts this directly via `-passwd`, so we never have to handle
# the plaintext password ourselves.
PASSWD_FILE="$(mktemp -t vortex-vnc-passwd.XXXXXX)"
trap 'rm -f "${PASSWD_FILE}"' EXIT
if ! docker cp "${CONTAINER}:/home/vortex/.config/tigervnc/passwd" "${PASSWD_FILE}" >/dev/null 2>&1; then
    echo "warning: could not read password file from container; falling back to interactive prompt." >&2
    PASSWD_FILE=""
fi
[[ -n "${PASSWD_FILE}" ]] && chmod 600 "${PASSWD_FILE}"

echo "Container : ${CONTAINER}"
echo "VNC       : localhost:${VNC_PORT}"
echo "Viewer    : ${VIEWER}"
echo

# TigerVNC-family viewers support -passwd; remmina/realvnc don't, so for
# those fall back to extracting the plaintext password from the entrypoint
# log and printing it so the user can paste it.
# Stay in the foreground so the EXIT trap fires and the temp passwd file is
# wiped after the viewer exits.
case "${VIEWER}" in
    xtigervncviewer|vncviewer|tigervnc)
        if [[ -n "${PASSWD_FILE}" ]]; then
            "${VIEWER}" -passwd "${PASSWD_FILE}" "localhost:${VNC_PORT}"
        else
            "${VIEWER}" "localhost:${VNC_PORT}"
        fi
        ;;
    remmina|realvnc-vncviewer)
        PASSWORD="$(docker logs "${CONTAINER}" 2>&1 \
            | sed -n 's/^\[vnc-entrypoint\] No VNC_PASSWORD supplied; generated one: //p' \
            | tail -n1 || true)"
        if [[ -n "${PASSWORD}" ]]; then
            echo "Password  : ${PASSWORD}"
        else
            echo "Password  : (use the value you passed via -e VNC_PASSWORD=...)"
        fi
        echo
        if [[ "${VIEWER}" == "remmina" ]]; then
            remmina -c "vnc://localhost:${VNC_PORT}"
        else
            "${VIEWER}" "localhost:${VNC_PORT}"
        fi
        ;;
    *)
        "${VIEWER}" "localhost:${VNC_PORT}"
        ;;
esac
