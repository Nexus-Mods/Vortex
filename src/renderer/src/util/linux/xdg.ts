import { XDG } from "@vortex/fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Synchronous helpers for XDG Base Directory Specification paths.
 * Uses typed XDG env-var name constants from @vortex/fs to avoid raw string literals.
 *
 * ref: https://specifications.freedesktop.org/basedir/latest
 */

function resolveXDGBase(envName: string, fallbackRelative: string): string {
  const envValue = process.env[envName];
  if (envValue && envValue.length > 0) {
    return envValue;
  }
  return path.join(os.homedir(), fallbackRelative);
}

/** Returns $XDG_DATA_HOME, defaulting to ~/.local/share */
export function xdgDataHome(): string {
  return resolveXDGBase(XDG.data, ".local/share");
}

/** Returns $XDG_CONFIG_HOME, defaulting to ~/.config */
export function xdgConfigHome(): string {
  return resolveXDGBase(XDG.config, ".config");
}

/** Returns $XDG_CACHE_HOME, defaulting to ~/.cache */
export function xdgCacheHome(): string {
  return resolveXDGBase(XDG.cache, ".cache");
}

/** Returns $XDG_STATE_HOME, defaulting to ~/.local/state */
export function xdgStateHome(): string {
  return resolveXDGBase(XDG.state, ".local/state");
}
