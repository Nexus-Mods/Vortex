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
# If invoked from inside a tmux session, Claude's output streams into a
# side pane (tail -f on a log file) so the main pane stays clean for the
# banners and summary table. Disable with NO_SPLIT=1.
#
# Environment overrides:
#   CONTAINER       Vortex VNC container name  (default: vortex-vnc)
#   VNC_MCP_IMAGE   MCP server image           (default: ghcr.io/regulad/vnc-mcp:latest)
#   NO_SPLIT        set to 1 to disable the tmux side pane
#   SPLIT_DIR       tmux pane direction: -h (horizontal, default) or -v
#
# Prerequisites: the Vortex VNC container must be running
# (`docker/linux/run.sh`). `claude` and `docker` must be on PATH.
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="${SCRIPT_DIR}/claude-prompts"

CONTAINER="${CONTAINER:-vortex-vnc}"
VNC_MCP_IMAGE="${VNC_MCP_IMAGE:-ghcr.io/regulad/vnc-mcp:latest}"

# Capture whether the script's real stdout is a TTY *before* any command
# substitution. Inside `$(...)` the function's stdout is a pipe, so an
# `-t 1` test there would always say "not a TTY" and we'd never pick a
# renderer.
STDOUT_IS_TTY=0
[[ -t 1 ]] && STDOUT_IS_TTY=1

# Pick a markdown renderer for prettifying claude's output. Falls back to
# plain `cat` if none are installed (or NO_RICH=1 is set). Honour the
# user's choice via $MD_RENDERER if they want to override the auto-pick.
choose_md_renderer() {
    if [[ -n "${NO_RICH:-}" || "${STDOUT_IS_TTY}" -ne 1 ]]; then
        echo "cat"
        return
    fi
    if [[ -n "${MD_RENDERER:-}" ]] && command -v "${MD_RENDERER%% *}" >/dev/null 2>&1; then
        echo "${MD_RENDERER}"
        return
    fi
    for candidate in "glow -" "mdcat" "bat --style=plain --paging=never --language=md"; do
        local bin="${candidate%% *}"
        if command -v "${bin}" >/dev/null 2>&1; then
            echo "${candidate}"
            return
        fi
    done
    echo "cat"
}
MD_RENDER_CMD="$(choose_md_renderer)"

# Format a single claude stream-json NDJSON line as a short human-readable
# event for the side pane. Falls back to raw passthrough if jq isn't on
# PATH. The `--unbuffered` flag keeps `tail -f` responsive.
format_stream_event() {
    if command -v jq >/dev/null 2>&1; then
        jq -rR --unbuffered '
            fromjson? // empty
            | if .type == "system" then
                "[system] \(.subtype // "ready")"
              elif .type == "assistant" then
                (.message.content // []) | map(
                    if .type == "text" then
                        "[assistant] " + ((.text // "") | split("\n")[0])
                    elif .type == "tool_use" then
                        "[tool] \(.name)(\(.input | tojson | .[0:120]))"
                    else "[" + .type + "]" end
                ) | join("\n")
              elif .type == "user" then
                (.message.content // []) | map(
                    if .type == "tool_result" then
                        "[result] " + ((.content // "") | tostring | gsub("\\s+"; " ") | .[0:120])
                    else "[" + .type + "]" end
                ) | join("\n")
              elif .type == "result" then
                "[done] \(.subtype // "")"
              else "[" + .type + "]" end
        '
    else
        cat
    fi
}

# Read claude stream-json NDJSON on stdin, write the final result event's
# `.result` field (the polished assistant response) to stdout. Returns
# empty if no result event was seen.
extract_final_result() {
    if command -v jq >/dev/null 2>&1; then
        jq -rRs '
            split("\n")
            | map(fromjson? // empty)
            | map(select(.type == "result"))
            | last
            | .result // empty
        '
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c '
import json, sys
result = ""
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        ev = json.loads(line)
    except Exception:
        continue
    if ev.get("type") == "result":
        result = ev.get("result", "") or ""
sys.stdout.write(result)
'
    else
        cat
    fi
}

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

# Output log used when streaming into a tmux side pane (see further down).
OUTPUT_LOG=""
TMUX_PANE_ID=""

cleanup() {
    rm -f "${MCP_CONFIG}"
    if [[ -n "${OUTPUT_LOG}" ]]; then
        rm -f "${OUTPUT_LOG}"
    fi
    if [[ -n "${TMUX_PANE_ID}" ]]; then
        tmux kill-pane -t "${TMUX_PANE_ID}" 2>/dev/null || true
    fi
}
trap cleanup EXIT

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

# If we're inside a tmux session, open a side pane and tail the output log
# there so the main pane stays clean for banners and the summary table.
USE_SPLIT=0
if [[ -z "${NO_SPLIT:-}" && -n "${TMUX:-}" && "${MODE}" != "interactive" ]] \
        && command -v tmux >/dev/null 2>&1; then
    OUTPUT_LOG="$(mktemp -t claude-vnc-output.XXXXXX.log)"
    SPLIT_DIR="${SPLIT_DIR:--h}"
    # -d: don't switch focus to the new pane. -P -F '#{pane_id}': print
    # the new pane's id so we can kill it on exit.
    TMUX_PANE_ID="$(tmux split-window "${SPLIT_DIR}" -d -P -F '#{pane_id}' \
        "tail -f '${OUTPUT_LOG}'")"
    USE_SPLIT=1
fi

echo "VNC       : ${VNC_HOST}:${VNC_PORT}"
echo "MCP image : ${VNC_MCP_IMAGE}"
echo "Config    : ${MCP_CONFIG}"
echo "Mode      : ${MODE}"
echo "Renderer  : ${MD_RENDER_CMD}"
if [[ ${USE_SPLIT} -eq 1 ]]; then
    echo "Output    : tmux pane ${TMUX_PANE_ID} (tail -f ${OUTPUT_LOG})"
fi
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
    local rc final
    if [[ ${USE_SPLIT} -eq 1 ]]; then
        # Banner in the side pane so the user can tell which prompt's
        # events are flowing.
        {
            printf '\n============================================================\n'
            printf '  PROMPT: %s\n' "$(basename "${prompt_file}" .md)"
            printf '============================================================\n\n'
        } >>"${OUTPUT_LOG}"

        # Stream every event to the side pane (via tee → format_stream_event)
        # while extracting the final assistant response for the main pane.
        # `--output-format=stream-json --verbose` makes claude emit one
        # NDJSON event per line.
        local final_file
        final_file="$(mktemp -t claude-vnc-final.XXXXXX)"
        set +e
        claude --print --output-format=stream-json --verbose \
            --add-dir "${HOME}" \
            "--mcp-config=${MCP_CONFIG}" -- "$(cat "${prompt_file}")" 2>&1 \
            | tee >(format_stream_event >>"${OUTPUT_LOG}") \
            | extract_final_result >"${final_file}"
        rc=${PIPESTATUS[0]}
        set -e
        final="$(cat "${final_file}")"
        rm -f "${final_file}"
        [[ -z "${final}" ]] && \
            final="(no final result extracted — see side pane for events)"

        # Render the polished final response in the main pane.
        printf '%s\n' "${final}" | eval "${MD_RENDER_CMD}"
        RUN_OUTPUT="${final}"
    else
        # Inline mode: no streaming, just --print and render in place.
        local out
        set +e
        out="$(claude --print --add-dir "${HOME}" "--mcp-config=${MCP_CONFIG}" -- "$(cat "${prompt_file}")" 2>&1)"
        rc=$?
        set -e
        printf '%s\n' "${out}" | eval "${MD_RENDER_CMD}"
        RUN_OUTPUT="${out}"
    fi
    if [[ ${rc} -eq 0 ]]; then
        RUN_STATUS="ok"
    else
        RUN_STATUS="fail"
    fi
    return 0
}

case "${MODE}" in
    interactive)
        claude --add-dir "${HOME}" "--mcp-config=${MCP_CONFIG}"
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
