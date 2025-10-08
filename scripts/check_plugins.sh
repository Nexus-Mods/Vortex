#!/usr/bin/env bash
set -euo pipefail

USER_PLUGINS_DIR="$HOME/Library/Application Support/Vortex/plugins"
mkdir -p "$USER_PLUGINS_DIR"

echo "[plugins] Using user plugins dir: $USER_PLUGINS_DIR"

# Locate any Balatro extension folders in the repo
echo "[search] Looking for Balatro extension directories in repo root"
FOUND_DIRS=$(find . -maxdepth 2 -type d -name '*Balatro*Vortex*Extension*' 2>/dev/null || true)
if [ -n "$FOUND_DIRS" ]; then
  echo "$FOUND_DIRS" | sed -n '1,200p'
else
  echo "[search] No Balatro folders found in repo root"
fi

# If found, copy the first match
FIRST_DIR=$(echo "$FOUND_DIRS" | head -n 1 || true)
if [ -n "$FIRST_DIR" ]; then
  echo "[copy] from $FIRST_DIR to $USER_PLUGINS_DIR/"
  rsync -a --exclude='.DS_Store' "$FIRST_DIR" "$USER_PLUGINS_DIR/"
  COPIED_NAME=$(basename "$FIRST_DIR")
  DEST_DIR="$USER_PLUGINS_DIR/$COPIED_NAME"
  echo "[list] $DEST_DIR"
  ls -la "$DEST_DIR" | sed -n '1,120p'
else
  echo "[copy] Skipping copy - no source directory found"
fi

# Show current contents of user plugins
echo "[plugins] $USER_PLUGINS_DIR"
ls -la "$USER_PLUGINS_DIR" | sed -n '1,120p'

# Show compiled util presence and bundledPlugins path
if [ -d "api/lib/util" ]; then
  echo "[compiled] api/lib/util exists"
  ls -la api/lib/util | sed -n '1,200p'
else
  echo "[compiled] api/lib/util missing"
fi

# Use Node to print getVortexPath('bundledPlugins') and readExtensionsSync result
node -e '
const path = require("path");
try {
  const getVortexPath = require("./api/lib/util/getVortexPath.js").default || require("./api/lib/util/getVortexPath.js");
  const bundled = getVortexPath("bundledPlugins");
  const userData = getVortexPath("userData");
  console.log("[paths] bundledPlugins:", bundled);
  console.log("[paths] userData:", userData);
} catch (e) {
  console.log("[paths] failed:", e.message);
}
try {
  const util = require("./api/lib/extensions/extension_manager/util.js");
  const res = util.readExtensionsSync(false);
  const keys = Object.keys(res);
  console.log("[readExtensionsSync] count:", keys.length);
  console.log("[readExtensionsSync] ids:", keys);
  const sample = keys.slice(0, 3).map(k => ({ id: k, info: res[k] }));
  console.log("[readExtensionsSync] sample:", JSON.stringify(sample, null, 2));
} catch (e) {
  console.log("[readExtensionsSync] failed:", e.message);
}
'