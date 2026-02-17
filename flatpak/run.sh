#!/bin/sh
# Only pass --download when a parameter %u is provided (nxm:// links from browser).
# This matches Windows behaviour, which includes --download on all protocol handler calls,
# but does not on non-handler calls (e.g., when starting from the start menu).
if [ -n "$1" ]; then
  exec zypak-wrapper /app/main/vortex --download "$@"
else
  exec zypak-wrapper /app/main/vortex
fi
