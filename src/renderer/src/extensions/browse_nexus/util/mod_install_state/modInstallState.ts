import { GameDomain, VortexGameId } from "@vortex/shared";

import { MOD_TYPE as COLLECTION_TYPE } from "@/extensions/collections/constants";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { IModWithState } from "@/extensions/mod_management/types/IModProps";
import { offersUpdate } from "@/extensions/mod_management/util/mod_has_update/modHasUpdate";
import groupMods from "@/extensions/mod_management/util/modGrouping";
import updateState, { type UpdateState } from "@/extensions/mod_management/util/modUpdateState";
import type { IProfileMod } from "@/extensions/profile_management/types/IProfile";

/** What the user already has of a Nexus Mods mod, so what Browse's button offers for it. */
export type ModInstallState =
  | {
      /** Being installed, by whichever button or page started it. */
      kind: "installing";
    }
  | {
      /** Installed, so shown on the Mods page. */
      kind: "installed";
      /** The installed version the Mods page shows: one with an update, if any has. */
      mod: IMod;
      /** The update the Mods page offers for it: a known file, or one to pick on the site. */
      update?: "update" | "update-site";
    }
  | {
      /** Downloaded, but not installed. */
      kind: "downloaded";
      /** One of its downloads, none of them installed. */
      downloadId: string;
    }
  | {
      /** Neither downloaded nor installed. */
      kind: "none";
    };

/** The mod to look for: its Nexus Mods id, and the domain that id belongs to. */
export interface INexusModRef {
  /** The game's Nexus Mods domain, which the mod's id is scoped to. */
  domain: GameDomain;
  /** The mod's game-scoped id on Nexus Mods. */
  modId: number;
}

/** What `modInstallState` looks through. */
export interface IModInstallSources {
  /** The active game's mods. */
  mods: { [modId: string]: IMod };
  /** The active profile's mod states, for which version of a file is the one shown. */
  modState: { [modId: string]: IProfileMod };
  /** Every download: this game's finished ones, and the ones installs are running from. */
  downloads: { [downloadId: string]: IDownload };
  /** The active game, which downloads must be for. */
  gameId: VortexGameId;
  /** The Nexus Mods domain of a Vortex game, as the update check resolves a mod's. */
  domainOf: (gameId: VortexGameId) => GameDomain | undefined;
}

/** Whether the Mods page offers an update in this state, as `offersUpdate` says. */
const isOffered = (state: UpdateState): state is "update" | "update-site" => offersUpdate(state);

/** The key a Nexus Mods mod is known by: its domain and id. */
export const modKey = (domain: GameDomain, modId: number) => `${domain}/${modId}`;

/**
 * The Nexus Mods mod a download is of, by its Nexus ids; none for one without them. A download
 * from an nxm link only gets its domain once the archive's lookup finds it, which can fail, so
 * until then it's its game's.
 */
export const downloadKey = (
  download: IDownload | undefined,
  domainOf: IModInstallSources["domainOf"],
) => {
  const ids = download?.modInfo?.nexus?.ids;

  if (!ids?.modId) {
    return undefined;
  }

  const [game] = download.game ?? [];
  const domain = ids.gameId ? GameDomain(ids.gameId) : game && domainOf(VortexGameId(game));

  return domain ? modKey(domain, Number(ids.modId)) : undefined;
};

/**
 * The Nexus Mods mod an installed mod is, by its Nexus ids and the game it was downloaded for;
 * none for one from elsewhere.
 */
export const nexusModKey = (
  mod: IMod,
  gameId: VortexGameId,
  domainOf: IModInstallSources["domainOf"],
) => {
  const domain = domainOf(VortexGameId(mod.attributes?.downloadGame ?? gameId));

  if (mod.attributes?.source !== "nexus" || !domain) {
    return undefined;
  }

  return modKey(domain, Number(mod.attributes?.modId));
};

/**
 * What the user has of a mod, matched by its Nexus Mods domain and id. Being installed is told
 * from the download it's installed from, as an install's mod only has its Nexus ids once it's
 * done. Installed counts the versions the Mods page shows, one per file, with the update its check
 * found if any has; otherwise a finished download of it in this game, or nothing.
 */
export const modInstallState = (
  { mods, modState, downloads, gameId, domainOf }: IModInstallSources,
  ref: INexusModRef,
): ModInstallState => {
  const key = modKey(ref.domain, ref.modId);
  const isOf = (download: IDownload | undefined) => downloadKey(download, domainOf) === key;
  const all = Object.values(mods).filter((mod) => mod.type !== COLLECTION_TYPE);

  const isInstalling = all.some(
    (mod) => mod.state === "installing" && !!mod.archiveId && isOf(downloads[mod.archiveId]),
  );

  if (isInstalling) {
    return { kind: "installing" };
  }

  const installed: IModWithState[] = all
    .filter((mod) => nexusModKey(mod, gameId, domainOf) === key)
    .map((mod) => ({ ...mod, ...modState[mod.id] }));

  const shown = groupMods(installed, { groupBy: "file", multipleEnabled: false }).map(
    ([primary]) => mods[primary.id],
  );

  for (const mod of shown) {
    const update = updateState(mod.attributes ?? {});
    if (isOffered(update)) {
      return { kind: "installed", mod, update };
    }
  }

  if (shown.length) {
    return { kind: "installed", mod: shown[0] };
  }

  const downloadId = Object.keys(downloads).find(
    (id) =>
      downloads[id].state === "finished" &&
      !!downloads[id].game?.includes(gameId) &&
      isOf(downloads[id]),
  );

  return downloadId ? { kind: "downloaded", downloadId } : { kind: "none" };
};
