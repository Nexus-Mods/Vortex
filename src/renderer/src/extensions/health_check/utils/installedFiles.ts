import type { IExtensionApi } from "../../../types/IExtensionContext";
import { renderModName } from "../../../util/api";
import { getSafe } from "../../../util/storeHelper";
import type { IMod } from "../../mod_management/types/IMod";
import { nexusGamesProm } from "../../nexus_integration/util";
import { makeFileUID } from "../../nexus_integration/util/UIDs";
import { activeProfile } from "../../profile_management/selectors";
import type { IInstalledFile } from "../types";

/** The subset of mod attributes the file-level gather/hydrate reads. */
interface IInstalledModAttributes {
  source?: string;
  fileId?: number | string;
  downloadGame?: string;
  version?: string;
  fileName?: string;
  logicalFileName?: string;
  pictureUrl?: string;
}

/**
 * An installed Nexus file for the resolver. It uses `fileUID` and `enabled`;
 * `modId` lets the output hydrate display data on demand.
 */
export interface IInstalledFileRef {
  /** Composite file version id (the resolver's fileVersionUid). */
  fileUID: string;
  /** Vortex mod id, for on-demand display hydration in the output. */
  modId: string;
  /** Whether the file is enabled in the active profile. */
  enabled: boolean;
}

/**
 * The active game's installed Nexus files (enabled and disabled) as resolver
 * input. Disabled files separate "disabled" / "wrong version" from "missing".
 */
export async function gatherInstalledFiles(api: IExtensionApi): Promise<IInstalledFileRef[]> {
  const state = api.getState();
  const profile = activeProfile(state);
  const gameId = profile?.gameId;
  if (!gameId) {
    return [];
  }

  // makeFileUID needs the Nexus games list, populated async on startup.
  await nexusGamesProm();

  const mods = state.persistent.mods[gameId] ?? {};
  const refs: IInstalledFileRef[] = [];

  for (const mod of Object.values(mods)) {
    const attributes: IInstalledModAttributes = mod.attributes ?? {};
    if (attributes.source !== "nexus" || mod.type === "collection") {
      continue;
    }
    if (attributes.fileId === undefined) {
      continue;
    }

    const fileUID = makeFileUID({
      gameId: attributes.downloadGame ?? gameId,
      fileId: attributes.fileId.toString(),
    });
    if (!fileUID) {
      continue;
    }

    refs.push({
      fileUID,
      modId: mod.id,
      enabled: getSafe(profile.modState, [mod.id, "enabled"], false),
    });
  }

  return refs;
}

/** Build the display shape for one installed file from its Vortex mod. */
function toInstalledFile(mod: IMod, fileUID: string, enabled: boolean): IInstalledFile {
  const attributes: IInstalledModAttributes = mod.attributes ?? {};
  const modName = renderModName(mod);
  return {
    modId: mod.id,
    fileUID,
    modName,
    fileName: attributes.fileName ?? attributes.logicalFileName ?? modName,
    version: attributes.version ?? "",
    thumbnailUrl: attributes.pictureUrl,
    adultContent: false, // TODO: enrich via mod details
    enabled,
  };
}

/**
 * A `fileUID -> IInstalledFile` hydrator over the gathered refs, reading the mod
 * store on demand so only surfaced files are hydrated.
 */
export function makeInstalledFileHydrator(
  api: IExtensionApi,
  refs: IInstalledFileRef[],
): (fileUID: string) => IInstalledFile | undefined {
  const state = api.getState();
  const gameId = activeProfile(state)?.gameId;
  const mods = gameId ? (state.persistent.mods[gameId] ?? {}) : {};
  const refByUID = new Map(refs.map((ref): [string, IInstalledFileRef] => [ref.fileUID, ref]));

  return (fileUID) => {
    const ref = refByUID.get(fileUID);
    if (!ref) {
      return undefined;
    }
    const mod = mods[ref.modId];
    if (!mod) {
      return undefined;
    }
    return toInstalledFile(mod, fileUID, ref.enabled);
  };
}
