#!/bin/zsh
set -euo pipefail

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_BASE="$HOME/Desktop/Vortex-Uninstall-Backup-$TS"
TRASH_DIR="$HOME/.Trash"

log() { printf "%s\n" "$*"; }

quit_vortex() {
  if pgrep -f "Vortex" >/dev/null 2>&1; then
    log "Requesting Vortex to quit..."
    osascript -e 'tell application "Vortex" to quit' || true
    # give it a moment
    sleep 2
  fi
}

mv_app_to_trash() {
  local app_path="$1"
  if [ -d "$app_path" ]; then
    mkdir -p "$TRASH_DIR"
    local name
    name=$(basename "$app_path")
    local target="$TRASH_DIR/${name%.app}-$TS.app"
    log "Moving app to Trash: $app_path -> $target"
    if /bin/mv "$app_path" "$target" 2>/dev/null; then
      log "Moved: $target"
    else
      log "WARNING: Couldn't move $app_path to Trash (permission?). Please remove manually."
    fi
  else
    log "Not found (skip): $app_path"
  fi
}

rm_if_exists() {
  local path="$1"
  if [ -e "$path" ]; then
    log "Removing: $path"
    /bin/rm -rf "$path"
  else
    log "Not found (skip): $path"
  fi
}

log "Starting Vortex full removal"
mkdir -p "$BACKUP_BASE" # reserved for future use if we add backups

quit_vortex

# Remove installed app(s)
mv_app_to_trash "/Applications/Vortex.app"
mv_app_to_trash "$HOME/Applications/Vortex.app"

# Remove user data and caches
rm_if_exists "$HOME/Library/Application Support/Vortex"
rm_if_exists "$HOME/Library/Caches/Vortex"
rm_if_exists "$HOME/Library/Logs/Vortex"
rm_if_exists "$HOME/Library/Preferences/com.nexusmods.vortex.plist"
rm_if_exists "$HOME/Library/Preferences/com.nexusmods.vortex.helper.plist"
rm_if_exists "$HOME/Library/Saved Application State/com.nexusmods.vortex.savedState"
rm_if_exists "$HOME/Library/LaunchAgents/com.nexusmods.vortex.plist"

# Remove any temp disable flags we created earlier
rm_if_exists "$HOME/Library/Caches/Vortex/temp/__disable_cyberpunk2077"

log "Done. If you also want to remove any external staging under /Volumes/*/Vortex Mods, let me know and I can purge those as well."