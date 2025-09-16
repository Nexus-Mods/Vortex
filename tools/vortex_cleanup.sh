#!/bin/zsh
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
BASE="$HOME/Desktop/Vortex-Cleanup-$TS"

log() { printf "%s\n" "$*"; }

move_if_exists() {
  local src="$1"
  local destdir="$2"
  if [ -e "$src" ]; then
    mkdir -p "$destdir"
    local name
    name=$(basename "$src")
    log "Moving: $src -> $destdir/$name"
    mv "$src" "$destdir/"
  else
    log "Not found (skip): $src"
  fi
}

mkdir -p "$BASE"

# Paths
VORTEX_USER="$HOME/Library/Application Support/Vortex"
VORTEX_TEMP="$HOME/Library/Caches/Vortex/temp"
PLUGINS="$VORTEX_USER/plugins"

log "Cleanup base: $BASE"

# 1) Remove user-installed CP2077 stub(s) from plugins -> move to backup
if [ -d "$PLUGINS" ]; then
  setopt local_options null_glob
  for p in "$PLUGINS"/cyberpunk* "$PLUGINS"/cp2077* "$PLUGINS"/game-cyberpunk2077*; do
    [ -e "$p" ] || continue
    move_if_exists "$p" "$BASE/plugins"
  done
else
  log "Plugins directory not found (skip): $PLUGINS"
fi

# 2) Create disable flag for bundled CP2077 stub
mkdir -p "$VORTEX_TEMP"
touch "$VORTEX_TEMP/__disable_cyberpunk2077"
log "Created disable flag: $VORTEX_TEMP/__disable_cyberpunk2077"

# 3) Move BG3 game-side files to backup
BG3_BASE="$HOME/Library/Application Support/Larian Studios/Baldur's Gate 3"
move_if_exists "$BG3_BASE/Mods" "$BASE/bg3-game"
move_if_exists "$BG3_BASE/PlayerProfiles/Public/modsettings.lsx" "$BASE/bg3-game"

# 4) Move staged mods from Vortex userData default locations
move_if_exists "$VORTEX_USER/baldursgate3/mods" "$BASE/staging-userdata"
move_if_exists "$VORTEX_USER/cyberpunk2077/mods" "$BASE/staging-userdata"

# 5) Move staged mods from external volumes under 'Vortex Mods'
setopt local_options null_glob
for gdir in /Volumes/*/"Vortex Mods"/baldursgate3 /Volumes/*/"Vortex Mods"/cyberpunk2077; do
  [ -e "$gdir" ] || continue
  move_if_exists "$gdir" "$BASE/staging-volumes"
done

log "Backup created at: $BASE"
log "Cleanup complete. You can now start Vortex."