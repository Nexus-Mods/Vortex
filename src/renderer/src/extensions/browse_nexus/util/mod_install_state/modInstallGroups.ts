import type { VortexGameId } from "@vortex/shared";

import {
  downloadKey,
  type IModInstallSources,
  type INexusModRef,
  type ModInstallState,
  modInstallState,
  modKey,
  nexusModKey,
} from "./modInstallState";

const NONE: ModInstallState = { kind: "none" };

/** Each download's key, by `downloadKey`; what grouping reads of the downloads. */
export const downloadKeysOf = (
  downloads: IModInstallSources["downloads"],
  domainOf: IModInstallSources["domainOf"],
): { [downloadId: string]: string | undefined } =>
  Object.fromEntries(
    Object.entries(downloads).map(([id, download]) => [id, downloadKey(download, domainOf)]),
  );

/** The ids of a mod's own mods and downloads, as `groupModInstallSources` files them. */
export interface IModInstallGroup {
  /** Its mods' ids. */
  mods: string[];
  /** Its downloads' ids. */
  downloads: string[];
}

/**
 * The active game's mods and downloads split up by the Nexus Mods mod they're of, by the same keys
 * `modInstallState` matches with, so a mod's state looks through its own and not the whole game's.
 * A mod is filed under its Nexus ids and under the download it's installed from, as an install's
 * mod only has its ids once it's done.
 */
export const groupModInstallSources = (
  mods: IModInstallSources["mods"],
  downloadKeys: { [downloadId: string]: string | undefined },
  gameId: VortexGameId,
  domainOf: IModInstallSources["domainOf"],
): Map<string, IModInstallGroup> => {
  const groups = new Map<string, IModInstallGroup>();

  const groupOf = (key: string) => {
    const group = groups.get(key) ?? { mods: [], downloads: [] };
    groups.set(key, group);
    return group;
  };

  for (const [id, key] of Object.entries(downloadKeys)) {
    if (key) {
      groupOf(key).downloads.push(id);
    }
  }

  for (const mod of Object.values(mods)) {
    const keys = new Set([
      nexusModKey(mod, gameId, domainOf),
      mod.archiveId ? downloadKeys[mod.archiveId] : undefined,
    ]);

    for (const key of keys) {
      if (key) {
        groupOf(key).mods.push(mod.id);
      }
    }
  }

  return groups;
};

/** The entries of `items` with these ids. */
const pick = <T>(items: { [id: string]: T }, ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, items[id]]));

/** What the user has of a mod, looking only through the sources its group has. */
export const groupedModInstallState = (
  groups: Map<string, IModInstallGroup>,
  sources: IModInstallSources,
  ref: INexusModRef,
): ModInstallState => {
  const group = groups.get(modKey(ref.domain, ref.modId));

  if (!group) {
    return NONE;
  }

  return modInstallState(
    {
      ...sources,
      mods: pick(sources.mods, group.mods),
      downloads: pick(sources.downloads, group.downloads),
    },
    ref,
  );
};
