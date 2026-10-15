# Vortex Linux + VNC Image

Builds Vortex from source on Ubuntu 26.04 and runs it inside a
TigerVNC server with the Fluxbox window manager. noVNC is also exposed so
the desktop can be reached from a browser.

## Build

```sh
docker/linux/build.sh
```

Pass extra `docker build` args through, e.g. `docker/linux/build.sh --no-cache`.
Use the script rather than a raw `docker build`: it passes the Node.js
version from `package.json`, gives the container's `vortex` user your
uid/gid (so it can write to the Chrome profile mounted from your home), and
stages Stardew Valley from your Steam root into
`~/.cache/vortex-qa/steam-context` (only `config/libraryfolders.vdf`, the
game's appmanifest and its game folder). It needs `jq`.

The first build takes several minutes — it installs the full Node.js + .NET
SDK + Electron + GTK toolchain, then runs `pnpm install` and
`pnpm nx run @vortex/main:build` inside the image. Network access is required so the
build can fetch DuckDB extensions and the Electron binary.

## Run

```sh
docker/linux/run.sh
```

This starts the `vortex-vnc` container detached, publishing 5901 (VNC),
6901 (noVNC), 9222 (Vortex DevTools) and 9223 (Chrome DevTools) on
`127.0.0.1` only. It also mounts a Chrome profile from the host
(`~/.cache/vortex-qa/chrome-profile`, override with `CHROME_PROFILE_DIR`)
so the Nexus Mods website login survives fresh containers. Pass extra
`docker run` args through, e.g. `docker/linux/run.sh -e VNC_PASSWORD=mypass`.

Then connect with the bundled helper:

```sh
docker/linux/connect.sh
```

It resolves the host-side port, prints the (auto-generated) password,
and launches the first VNC viewer it finds on PATH
(`xtigervncviewer` / `vncviewer` / `remmina` / ...) pointed at
`localhost:5901`. Paste the password when prompted. Pass an alternate
container name as the first argument if you didn't use `--name vortex-vnc`.

Install a viewer if you don't have one:

```sh
sudo apt install tigervnc-viewer    # Debian/Ubuntu
```

The container also exposes noVNC on `http://localhost:6901/vnc.html` as a
browser-based fallback; `docker logs vortex-vnc` shows the password if you
need to enter it there.

## Configuration

All knobs are environment variables — override them with `-e` on
`docker run`:

| Variable                  | Default                | Purpose                                  |
| ------------------------- | ---------------------- | ---------------------------------------- |
| `VNC_PASSWORD`            | _random, logged on start_ | Password the VNC client must supply. Pass via `-e` to set explicitly. |
| `VNC_PORT`                | `5901`                 | RFB port inside the container.           |
| `NOVNC_PORT`              | `6901`                 | HTTP port for the noVNC web client.      |
| `VNC_GEOMETRY`            | `1600x1000`            | Desktop resolution.                      |
| `VNC_DEPTH`               | `24`                   | Colour depth.                            |
| `VNC_DISPLAY`             | `:1`                   | X display number to start.               |
| `ELECTRON_DISABLE_SANDBOX`| `1`                    | Required when running Electron in Docker.|

`VNC_PASSWORD` has no default in the image so it can't leak via `docker
inspect`. If you don't pass one, the entrypoint generates an 8-character
random password and prints it to the container log on startup.

## Driving Vortex from Claude Code

`docker/linux/claude-vnc.sh` launches `claude` wired up to the running VNC
session via a VNC MCP server. With no arguments it runs **every** prompt
in `docker/linux/claude-prompts/` (non-interactively, one after the other)
and prints a summary table at the end. Pass a specific prompt file to run
just that one, or `--no-prompt` for an interactive session.

```sh
docker/linux/claude-vnc.sh                                  # run all prompts + summary
docker/linux/claude-vnc.sh docker/linux/claude-prompts/...  # run a single prompt
docker/linux/claude-vnc.sh --no-prompt                      # interactive session
```

Claude's per-prompt output is rendered as rich markdown in the terminal
when a renderer is available (`glow`, `mdcat`, or `bat` in that order of
preference; falls back to plain text). Override via `MD_RENDERER='glow -'`
or disable with `NO_RICH=1`.

### Running inside tmux (recommended for batch runs)

If you launch the script from inside a **tmux session**, the script runs
claude in streaming mode (`--output-format=stream-json --verbose`) and
splits the work across two panes:

- **Main pane**: the polished final answer for each prompt (markdown-
  rendered via `glow` / `mdcat` / `bat`) followed by the summary table.
- **Side pane**: claude's live working output — one line per event, e.g.
  `[tool] vnc__click_at_current_position(...)`, `[result] {...}`,
  `[assistant] I can see Vortex is running...`. Tails a temp log file via
  `tail -f`, and is closed automatically when the script exits.

The script needs `jq`, both for the side-pane events and to extract the
final response for the main pane.

Three common ways to start it:

```sh
# 1) Open a tmux session interactively, then run the script in it.
tmux new -s vortex
# (now inside tmux)
docker/linux/claude-vnc.sh
```

```sh
# 2) One-liner: start tmux and run the script. Drops you in a shell when
#    the script finishes so the side pane's contents stay visible.
tmux new -s vortex 'docker/linux/claude-vnc.sh; exec bash'
```

```sh
# 3) Background it and attach later.
tmux new -d -s vortex 'docker/linux/claude-vnc.sh; exec bash'
tmux attach -t vortex
```

Inside tmux: `Ctrl-b d` detaches, `tmux attach -t vortex` reattaches,
`Ctrl-b o` cycles focus between the main pane and the side pane, and
`exit` (or `Ctrl-d`) in the last pane kills the session.

Defaults to a horizontal split — set `SPLIT_DIR=-v` for a vertical split,
or `NO_SPLIT=1` to keep everything inline (no side pane).

If `$TMUX` is not set (you're not inside a tmux session) the script
silently runs inline; nothing breaks if tmux isn't installed at all.

The script resolves the host VNC port and the entrypoint-generated
password automatically, writes a temporary MCP config that runs the
[regulad/vnc-mcp](https://github.com/regulad/vnc-mcp) server image (pinned
by digest) with `--network=host` and the VNC connection details passed via
environment variables, plus two `@playwright/mcp` servers (pinned by
version) attached to the Vortex and Chrome DevTools ports, then launches
`claude --mcp-config ...`. The temp config is deleted on exit. Override
the VNC image with `VNC_MCP_IMAGE=...`.

### Prompts, results and permissions

- `docker/linux/qa-notes.md` holds field notes from earlier runs. It is
  prepended to every prompt.
- Every prompt ends its report with one `RESULT:` line: `PASS`,
  `PASS_WITH_FLAGS`, `FAIL` or `BLOCKED`. `docker/linux/result-verdict`
  reads it, and the script exits non-zero unless every prompt run reports
  `PASS` or `PASS_WITH_FLAGS` (a report without the line counts as a
  failure). Test the parsing with `docker/linux/result-verdict.test.sh`.
- Non-interactive runs use `--permission-mode dontAsk`: anything not
  allowed in `.claude/settings.json` is refused instead of waiting for an
  approval nobody can give. The allow list covers the three MCP servers
  and `docker exec vortex-vnc game-click`.
- The run uses Sonnet by default; `CLAUDE_MODEL=opus` (or `haiku`, ...)
  picks another model.
- The agent never signs in to the website. If the saved Chrome session
  has expired, the run reports `BLOCKED`: sign in once by hand over
  noVNC, and later runs reuse the session.

## Notes

- The container runs as the non-root user `vortex`, with the uid/gid of
  whoever ran `build.sh`.
- The default `CMD` is `pnpm -C src/main start`, which launches the Electron dev build
  produced by `pnpm nx run @vortex/main:build`. Override the command (e.g.
  `docker run ... vortex-vnc bash`) to drop into a shell inside the VNC
  session.
