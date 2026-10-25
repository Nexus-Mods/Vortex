import type { IMod } from "../mod_management/types/IMod";
import updateState from "../mod_management/util/modUpdateState";
import versionClean from "../mod_management/util/versionClean";
import type { ICatalogMod, InstallState } from "./types";

/** Installed mods that came from this Nexus mod page. */
export function installedFromNexus(
  mods: { [id: string]: IMod } | undefined,
  modId: number,
): IMod[] {
  return Object.values(mods ?? {}).filter((mod) => {
    const attrs = mod.attributes ?? {};
    return attrs.source === "nexus" && Number(attrs.modId) === modId;
  });
}

/**
 * "installed" when any file of the mod is installed for the active game, "update-available"
 * when Vortex's own update check found a newer file, or when the version on the site differs
 * from the installed one (Vortex treats any version change as an update, as versioning
 * schemes vary too much to tell newer from older).
 */
export function catalogInstallState(
  mods: { [id: string]: IMod } | undefined,
  catalogMod: Pick<ICatalogMod, "modId" | "version">,
): InstallState {
  const installed = installedFromNexus(mods, catalogMod.modId);
  if (installed.length === 0) {
    return "not-installed";
  }

  const hasUpdate = installed.some((mod) => {
    const state = updateState(mod.attributes ?? {});
    if (state !== "current" && state !== "install") {
      return true;
    }
    const installedVersion: string | undefined = mod.attributes?.version;
    return (
      catalogMod.version.length > 0 &&
      installedVersion !== undefined &&
      installedVersion.length > 0 &&
      versionClean(catalogMod.version) !== versionClean(installedVersion)
    );
  });

  return hasUpdate ? "update-available" : "installed";
}
