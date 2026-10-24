#!/bin/sh
# pacman owns installs and upgrades, so Vortex's own updater stays off.
export IGNORE_UPDATES=yes

# Only pass --download when a parameter %u is provided (nxm:// links from browser).
# This matches Windows behaviour, which includes --download on all protocol handler calls,
# but does not on non-handler calls (e.g., when starting from the start menu).
if [ -n "$1" ]; then
  exec /opt/vortex/vortex --download "$@"
else
  exec /opt/vortex/vortex
fi
