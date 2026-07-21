import type * as Redux from "redux";

import type { IState } from "../../../types/IState";
import { setDownloadModInfo } from "../../download_management/actions/state";
import { setModAttribute } from "../../mod_management/actions/mods";

// CDN storage paths ("5c/d3/1f/<guid>") leaked into name attributes on
// 2.4.0-beta.1 (LAZ-807). The "xx/yy/zz/" prefix is enough to identify them;
// no legitimate name starts with that.
const STORAGE_PATH_PREFIX = /^[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\//i;

export function isStoragePathName(name: unknown): name is string {
  return typeof name === "string" && STORAGE_PATH_PREFIX.test(name);
}

// "5c/d3/1f/<guid> - Friendly Name" -> "Friendly Name", undefined if not polluted
export function stripStoragePathPrefix(name: string): string | undefined {
  if (!isStoragePathName(name)) {
    return undefined;
  }
  const sep = name.indexOf(" - ");
  return sep !== -1 ? name.slice(sep + 3) : undefined;
}

/**
 * Repair names polluted by the 2.4.0-beta.1 storage-path regression (LAZ-807).
 * Idempotent; applied once via the healStoragePathNames_2_4 migration.
 */
export function healStoragePathNameActions(state: IState): Redux.Action[] {
  const actions: Redux.Action[] = [];
  const downloads = state.persistent.downloads?.files ?? {};

  for (const [dlId, download] of Object.entries(downloads)) {
    if (isStoragePathName(download.modInfo?.name)) {
      const friendly = download.modInfo?.nexus?.fileInfo?.name;
      if (friendly) {
        actions.push(setDownloadModInfo(dlId, "name", friendly));
      }
    }
  }

  for (const [gameId, gameMods] of Object.entries(state.persistent.mods ?? {})) {
    for (const [modId, mod] of Object.entries(gameMods)) {
      const attributes = mod.attributes ?? {};
      const download = mod.archiveId !== undefined ? downloads[mod.archiveId] : undefined;

      const stripped =
        typeof attributes.customFileName === "string"
          ? stripStoragePathPrefix(attributes.customFileName)
          : undefined;
      if (stripped !== undefined) {
        actions.push(setModAttribute(gameId, modId, "customFileName", stripped));
      }

      // modInfo.name is missing on the polluted downloads, so fall back to the
      // file name, then to the name recovered from customFileName (covers mods
      // whose archive was deleted)
      const fileName = download?.modInfo?.nexus?.fileInfo?.name;

      if (isStoragePathName(attributes.logicalFileName)) {
        const friendlyFile = fileName ?? stripped;
        if (friendlyFile) {
          actions.push(setModAttribute(gameId, modId, "logicalFileName", friendlyFile));
        }
      }

      if (isStoragePathName(attributes.modName)) {
        const friendlyMod = (download?.modInfo?.nexus?.modInfo?.name ??
          fileName ??
          stripped) as string;
        if (friendlyMod) {
          actions.push(setModAttribute(gameId, modId, "modName", friendlyMod));
        }
      }
    }
  }

  return actions;
}
