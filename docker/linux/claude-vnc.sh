#!/usr/bin/env bash
# Launch `claude` wired up to the Vortex VNC session via the regulad/vnc-mcp
# server (https://github.com/regulad/vnc-mcp), which is distributed as a
# Docker image (`ghcr.io/regulad/vnc-mcp`) and reads VNC connection details
# from environment variables.
#
# Usage:
#   docker/linux/claude-vnc.sh                     # run every prompt in claude-prompts/ and summarise
#   docker/linux/claude-vnc.sh path/to/prompt.md   # run a single prompt (non-interactive)
#   docker/linux/claude-vnc.sh --no-prompt         # interactive session, no prompt
#
# Environment overrides:
#   CONTAINER       Vortex VNC container name  (default: vortex-vnc)
#   VNC_MCP_IMAGE   MCP server image           (default: ghcr.io/regulad/vnc-mcp:latest)
#
# Prerequisites: the Vortex VNC container must be running
# (`docker/linux/run.sh`). `claude` and `docker` must be on PATH.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="${SCRIPT_DIR}/claude-prompts"

CONTAINER="${CONTAINER:-vortex-vnc}"
VNC_MCP_IMAGE="${VNC_MCP_IMAGE:-ghcr.io/regulad/vnc-mcp:latest}"

# Mode: "all" (default) | "single" | "interactive"
MODE="all"
SINGLE_PROMPT=""
case "${1:-}" in
    "") MODE="all" ;;
    --no-prompt) MODE="interactive" ;;
    *) MODE="single"; SINGLE_PROMPT="$1" ;;
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
echo "Mode      : ${MODE}"
echo

# Runs claude --print non-interactively on one prompt file, echoing the
# full output and capturing it into a global for the end-of-run summary.
# Sets RUN_STATUS to "ok" or "fail" based on claude's exit code.
RUN_STATUS=""
RUN_OUTPUT=""
run_one_prompt() {
    local prompt_file="$1"
    if [[ ! -r "${prompt_file}" ]]; then
        echo "error: prompt file not readable: ${prompt_file}" >&2
        RUN_STATUS="fail"
        RUN_OUTPUT="(prompt file not readable)"
        return 1
    fi
    # `--print` runs non-interactively and writes claude's final response
    # to stdout. `--mcp-config=` uses the `=` form to avoid the next
    # positional arg being consumed as another config path. `--` then
    # separates flags from the positional prompt body.
    local out rc
    set +e
    out="$(claude --print "--mcp-config=${MCP_CONFIG}" -- "$(cat "${prompt_file}")" 2>&1)"
    rc=$?
    set -e
    echo "${out}"
    RUN_OUTPUT="${out}"
    if [[ ${rc} -eq 0 ]]; then
        RUN_STATUS="ok"
    else
        RUN_STATUS="fail"
    fi
    return 0
}

case "${MODE}" in
    interactive)
        claude "--mcp-config=${MCP_CONFIG}"
        ;;
    single)
        run_one_prompt "${SINGLE_PROMPT}"
        ;;
    all)
        shopt -s nullglob
        prompts=("${PROMPTS_DIR}"/*.md)
        shopt -u nullglob
        if [[ ${#prompts[@]} -eq 0 ]]; then
            echo "error: no prompts found in ${PROMPTS_DIR}" >&2
            exit 1
        fi

        declare -a result_names result_status result_last
        for prompt in "${prompts[@]}"; do
            name="$(basename "${prompt}" .md)"
            echo "============================================================"
            echo "  PROMPT: ${name}"
            echo "============================================================"
            run_one_prompt "${prompt}"
            echo
            result_names+=("${name}")
            result_status+=("${RUN_STATUS}")
            # Keep the last non-empty line as a one-line summary anchor.
            last="$(echo "${RUN_OUTPUT}" | awk 'NF{line=$0} END{print line}')"
            result_last+=("${last}")
        done

        echo "============================================================"
        echo "  SUMMARY"
        echo "============================================================"
        # Compute padding so the status column lines up.
        max=0
        for n in "${result_names[@]}"; do
            (( ${#n} > max )) && max=${#n}
        done
        for i in "${!result_names[@]}"; do
            printf "  %-${max}s  [%s]  %s\n" \
                "${result_names[$i]}" \
                "${result_status[$i]}" \
                "${result_last[$i]}"
        done
        ;;
esac
