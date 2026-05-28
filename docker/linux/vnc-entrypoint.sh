#!/usr/bin/env bash
# Boots TigerVNC + Fluxbox, exposes the desktop over noVNC, then runs the
# supplied command (defaults to `pnpm start`, which launches Vortex via
# Electron) inside that desktop session.
#
# `pipefail` is intentionally NOT set: we use `head -c N` and `tail` on
# pipes that legitimately close early (e.g. /dev/urandom), and pipefail
# would surface those SIGPIPEs as fatal errors under `set -e`.
set -eu

DISPLAY_NUM="${VNC_DISPLAY:-:1}"
GEOMETRY="${VNC_GEOMETRY:-1600x1000}"
DEPTH="${VNC_DEPTH:-24}"
VNC_PORT="${VNC_PORT:-5901}"
NOVNC_PORT="${NOVNC_PORT:-6901}"

# If no password was provided at `docker run` time, mint a random one and log
# it so the user can still connect. We never bake a default into the image.
# Standard VncAuth uses an 8-char key (longer values are truncated by
# vncpasswd), so cap at 8. Use pure bash — no pipes — so we can't hit
# SIGPIPE on the password-generation step.
if [[ -z "${VNC_PASSWORD:-}" ]]; then
    chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    VNC_PASSWORD=""
    for ((i = 0; i < 8; i++)); do
        VNC_PASSWORD+="${chars:RANDOM%${#chars}:1}"
    done
    echo "[vnc-entrypoint] No VNC_PASSWORD supplied; generated one: ${VNC_PASSWORD}"
fi

# Modern TigerVNC uses ~/.config/tigervnc; if only ~/.vnc exists it tries to
# migrate via rename, which fails when ~/.config doesn't exist yet. Write
# straight to the new layout to sidestep the migration entirely.
VNC_CONFIG_DIR="${HOME}/.config/tigervnc"
mkdir -p "${VNC_CONFIG_DIR}" "${HOME}/.local/state/tigervnc"

# Materialise the VNC password file from the env var so the password is not
# baked into the image. `vncpasswd -f` reads a plain password from stdin and
# writes the obfuscated form to stdout. Use a here-doc (backed by a temp
# file, not a pipe) so we can't get SIGPIPE if vncpasswd closes stdin after
# reading the 8-char limit.
vncpasswd -f >"${VNC_CONFIG_DIR}/passwd" <<EOF
${VNC_PASSWORD}
EOF
chmod 600 "${VNC_CONFIG_DIR}/passwd"
unset VNC_PASSWORD

# Window manager and a terminal, so the user can poke at the session if
# Vortex itself fails to launch.
cat >"${VNC_CONFIG_DIR}/xstartup" <<'EOF'
#!/usr/bin/env bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XKL_XMODMAP_DISABLE=1
xsetroot -solid '#202225'
xterm -geometry 100x24+10+10 &
exec fluxbox
EOF
chmod +x "${VNC_CONFIG_DIR}/xstartup"

# Clean up any stale lock files from a previous container run that crashed.
rm -f "/tmp/.X${DISPLAY_NUM#:}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM#:}" || true

echo "[vnc-entrypoint] Starting Xvnc on ${DISPLAY_NUM} (${GEOMETRY}x${DEPTH})"
# -AlwaysShared + -DisconnectClients=0 let multiple viewers attach to the
# same session simultaneously (instead of the default "new connection kicks
# the previous one").
vncserver "${DISPLAY_NUM}" \
    -geometry "${GEOMETRY}" \
    -depth "${DEPTH}" \
    -rfbport "${VNC_PORT}" \
    -localhost no \
    -SecurityTypes VncAuth \
    -PasswordFile "${VNC_CONFIG_DIR}/passwd" \
    -AlwaysShared \
    -DisconnectClients=0

# noVNC bridge -> http://<host>:${NOVNC_PORT}/vnc.html
NOVNC_DIR=""
for candidate in /usr/share/novnc /usr/share/webapps/novnc; do
    if [[ -d "${candidate}" ]]; then
        NOVNC_DIR="${candidate}"
        break
    fi
done

if [[ -n "${NOVNC_DIR}" ]]; then
    echo "[vnc-entrypoint] Starting noVNC on :${NOVNC_PORT} (web root: ${NOVNC_DIR})"
    websockify --web "${NOVNC_DIR}" "${NOVNC_PORT}" "localhost:${VNC_PORT}" &
else
    echo "[vnc-entrypoint] noVNC web root not found; skipping browser bridge."
fi

echo "[vnc-entrypoint] Ready. From the host, run: docker/linux/connect.sh"

# Tear everything down cleanly when the container stops.
shutdown() {
    echo "[vnc-entrypoint] Shutting down..."
    vncserver -kill "${DISPLAY_NUM}" >/dev/null 2>&1 || true
    jobs -p | xargs -r kill || true
}
trap shutdown EXIT INT TERM

export DISPLAY="${DISPLAY_NUM}"

# Electron in a container has no usable sandbox; run with --no-sandbox unless
# the caller has overridden it.
if [[ "${ELECTRON_DISABLE_SANDBOX:-1}" == "1" ]]; then
    export ELECTRON_DISABLE_SANDBOX=1
fi

echo "[vnc-entrypoint] Launching: $*"
exec "$@"
