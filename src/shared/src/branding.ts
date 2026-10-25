/**
 * mkeiitmods branding.
 *
 * mkeiitmods is a fork of Vortex. Internal identifiers (package names, the
 * extension API, `getVortexPath` and so on) keep the Vortex names so game
 * extensions and upstream merges keep working. Everything the user sees, and
 * everything that identifies the app to other services, comes from here.
 */

/** Name shown to the user and sent to the Nexus Mods API. */
export const APP_DISPLAY_NAME: string = "mkeiitmods";

/** Electron app name; also the name of the per-user data folder. */
export const APP_NAME: string = "mkeiitmods";

/** Folder (under appData) holding the persistent state of a production build. */
export const APP_STATE_DIR: string = "mkeiitmods";

/** Folder (under appData) holding the persistent state of a development build. */
export const APP_STATE_DIR_DEVEL: string = "mkeiitmods_devel";

/**
 * The built-in updater resolves releases from the official Vortex GitHub
 * repository and would replace mkeiitmods with Vortex. It stays off until
 * mkeiitmods has its own release feed.
 */
export const UPDATER_ENABLED: boolean = false;

/**
 * Usage analytics (Mixpanel), error/crash reports and traces (OpenTelemetry
 * collector) and remote feature flags (Unleash) all go to Nexus Mods services
 * that belong to Vortex. mkeiitmods sends none of it. While this is false no
 * setting or consent can turn them back on.
 */
export const TELEMETRY_ENABLED: boolean = false;

/** Where the upstream project lives, for "based on Vortex" credits. */
export const UPSTREAM_NAME: string = "Vortex (Nexus Mods)";

/**
 * Folder names the original Vortex uses for its data, compared case-insensitively
 * because Windows paths are case-insensitive (`%APPDATA%\Vortex` == `%APPDATA%\vortex`).
 * mkeiitmods must never read or write any of these.
 */
const VORTEX_DATA_DIR_NAMES: readonly string[] = ["vortex", "vortex_devel", "@vortex"];

function pathSegments(input: string): string[] {
  return input
    .split(/[\\/]+/)
    .filter((seg) => seg.length > 0)
    .map((seg) => seg.toLowerCase());
}

/**
 * True if the path is, or is inside, one of the folders the original Vortex
 * stores its data in (e.g. `%APPDATA%\Vortex`, `%APPDATA%\vortex_devel`,
 * `%ProgramData%\vortex`).
 *
 * Only the segment directly below a known data root counts, so an unrelated
 * folder deeper down that happens to be called "vortex" (a game's own mods
 * folder, say) does not trip it.
 */
export function isVortexDataPath(candidate: string, dataRoots: readonly string[]): boolean {
  const target = pathSegments(candidate);
  return dataRoots.some((root) => {
    const rootSegs = pathSegments(root);
    if (rootSegs.length === 0 || target.length <= rootSegs.length) {
      return false;
    }
    const sameRoot = rootSegs.every((seg, idx) => target[idx] === seg);
    return sameRoot && VORTEX_DATA_DIR_NAMES.includes(target[rootSegs.length]!);
  });
}
