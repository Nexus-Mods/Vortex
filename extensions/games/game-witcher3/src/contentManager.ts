/**
 * The Remastered edition gained a `[ContentManager/Mods]` section in
 * `dx12user.settings` holding master switches for mod loading. With either of
 * them off the game ignores everything Vortex deploys, and nothing surfaces on
 * the Vortex side, so it has to be checked explicitly.
 *
 * Kept free of Vortex API imports so it can be unit tested.
 */

export const CONTENT_MANAGER_MODS_SECTION = "ContentManager/Mods";

export const ContentManagerState = {
  /** Mods are loading normally. */
  Ok: "ok",
  /** All mod loading is off. */
  ModsDisabled: "mods-disabled",
  /** mod.io and Workshop mods still load, but nothing we deploy does. */
  LocalModsDisabled: "local-mods-disabled",
  /** Section absent - the game most likely hasn't been run yet. */
  Unknown: "unknown",
} as const;
export type ContentManagerState = (typeof ContentManagerState)[keyof typeof ContentManagerState];

// The game writes these as `false`, but accept the numeric form too since the
// file is hand-editable and the ini parser hands values back as strings.
function isSwitchedOff(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  const normalised = String(value).trim().toLowerCase();
  return normalised === "false" || normalised === "0";
}

// key: ini section name, then key name within that section
type IniData = Record<string, Record<string, unknown>>;

export function evaluateContentManagerSettings(data: IniData | undefined): ContentManagerState {
  const section = data?.[CONTENT_MANAGER_MODS_SECTION];
  if (section === undefined) {
    return ContentManagerState.Unknown;
  }
  if (isSwitchedOff(section.Enabled)) {
    return ContentManagerState.ModsDisabled;
  }
  if (isSwitchedOff(section.EnabledLocal)) {
    return ContentManagerState.LocalModsDisabled;
  }
  return ContentManagerState.Ok;
}
