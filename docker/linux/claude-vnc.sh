#!/usr/bin/env bash
# Launch `claude` wired up to the Vortex VNC session via the regulad/vnc-mcp
# server (https://github.com/regulad/vnc-mcp), which is distributed as a
# Docker image (`ghcr.io/regulad/vnc-mcp`) and reads VNC connection details
# from environment variables.
#
# Usage:
#   docker/linux/claude-vnc.sh                                # default prompt
#   docker/linux/claude-vnc.sh path/to/prompt.md              # custom prompt
#   docker/linux/claude-vnc.sh --no-prompt                    # interactive only
#
# Environment overrides:
#   CONTAINER       Vortex VNC container name  (default: vortex-vnc)
#   VNC_MCP_IMAGE   MCP server image           (default: ghcr.io/regulad/vnc-mcp:latest)
#
# Prerequisites: the Vortex VNC container must be running
# (`docker/linux/run.sh`). `claude` and `docker` must be on PATH.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PROMPT="${SCRIPT_DIR}/claude-prompts/check-settings.md"

CONTAINER="${CONTAINER:-vortex-vnc}"
VNC_MCP_IMAGE="${VNC_MCP_IMAGE:-ghcr.io/regulad/vnc-mcp:latest}"

PROMPT_FILE="${DEFAULT_PROMPT}"
INTERACTIVE_ONLY=0
case "${1:-}" in
    --no-prompt) INTERACTIVE_ONLY=1 ;;
    "") ;;
    *) PROMPT_FILE="$1" ;;
esac

if ! command -v docker >/dev/null 2>&1; then
    echo "error: docker is not on PATH" >&2
    exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
    echo "error: claude CLI is not on PATH" >&2
    echo "       Install with: npm install -g @anthropic-ai/claude-code" >&2
    exit 1
fi

# Make sure the VNC container exists, is running, and exposes 5901.
if ! docker container inspect "${CONTAINER}" >/dev/null 2>&1; then
    echo "error: container '${CONTAINER}' not found. Start it with docker/linux/run.sh." >&2
    exit 1
fi
state="$(docker container inspect -f '{{.State.Status}}' "${CONTAINER}")"
if [[ "${state}" != "running" ]]; then
    echo "error: container '${CONTAINER}' is not running (state: ${state})." >&2
    exit 1
fi

mapping="$(docker port "${CONTAINER}" 5901/tcp 2>/dev/null | head -n1 || true)"
if [[ -z "${mapping}" ]]; then
    echo "error: container '${CONTAINER}' does not publish 5901/tcp." >&2
    exit 1
fi
VNC_HOST="localhost"
VNC_PORT="${mapping##*:}"

# Scrape the auto-generated password from the entrypoint log; fall back to
# whatever the caller set via $VNC_PASSWORD.
PASSWORD="${VNC_PASSWORD:-$(docker logs "${CONTAINER}" 2>&1 \
    | sed -n 's/^\[vnc-entrypoint\] No VNC_PASSWORD supplied; generated one: //p' \
    | tail -n1 || true)}"
if [[ -z "${PASSWORD}" ]]; then
    echo "error: could not determine VNC password." >&2
    echo "       Pass VNC_PASSWORD=... in the environment, or restart the" >&2
    echo "       container so the entrypoint logs the generated one." >&2
    exit 1
fi

# Materialise a one-shot MCP config pointing claude at the VNC server.
# Goes under the user's $TMPDIR so it doesn't leak into the repo.
MCP_CONFIG="$(mktemp -t vortex-vnc-mcp.XXXXXX.json)"
trap 'rm -f "${MCP_CONFIG}"' EXIT

# MCP config launches the regulad/vnc-mcp docker image with --network=host
# (so localhost:5901 inside the MCP container reaches the host's published
# Vortex VNC port) and passes VNC details through environment variables.
# Putting secrets in `env` (rather than `args`) keeps them off the docker
# command line for `ps` snooping.
cat >"${MCP_CONFIG}" <<JSON
{
  "mcpServers": {
    "vnc": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--pull=always", "--network=host",
        "--env", "VNCMCP_HOST",
        "--env", "VNCMCP_PORT",
        "--env", "VNCMCP_PASSWORD",
        "${VNC_MCP_IMAGE}"
      ],
      "env": {
        "VNCMCP_HOST": "${VNC_HOST}",
        "VNCMCP_PORT": "${VNC_PORT}",
        "VNCMCP_PASSWORD": "${PASSWORD}"
      }
    }
  }
}
JSON

echo "VNC       : ${VNC_HOST}:${VNC_PORT}"
echo "MCP image : ${VNC_MCP_IMAGE}"
echo "Config    : ${MCP_CONFIG}"
if [[ "${INTERACTIVE_ONLY}" -eq 1 ]]; then
    echo "Prompt    : (none, interactive)"
else
    echo "Prompt    : ${PROMPT_FILE}"
fi
echo

if [[ "${INTERACTIVE_ONLY}" -eq 1 ]]; then
    claude "--mcp-config=${MCP_CONFIG}"
else
    if [[ ! -r "${PROMPT_FILE}" ]]; then
        echo "error: prompt file not readable: ${PROMPT_FILE}" >&2
        exit 1
    fi
    # `=` keeps the flag value unambiguous (some claude versions otherwise
    # treat the next positional arg as another --mcp-config value).
    # `--` separates flags from the positional prompt.
    claude "--mcp-config=${MCP_CONFIG}" -- "$(cat "${PROMPT_FILE}")"
fi
