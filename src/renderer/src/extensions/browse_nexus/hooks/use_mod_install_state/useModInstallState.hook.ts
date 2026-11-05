import { GameDomain, VortexGameId } from "@vortex/shared";
import { shallowEqual, useSelector } from "react-redux";
import { createSelector } from "reselect";

import { MOD_TYPE as COLLECTION_TYPE } from "@/extensions/collections/constants";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { knownGames } from "@/extensions/gamemode_management/selectors";
import type { IGameStored } from "@/extensions/gamemode_management/types/IGameStored";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import type { IModWithState } from "@/extensions/mod_management/types/IModProps";
import { offersUpdate } from "@/extensions/mod_management/util/mod_has_update/modHasUpdate";
import groupMods from "@/extensions/mod_management/util/modGrouping";
import updateState, { type UpdateState } from "@/extensions/mod_management/util/modUpdateState";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IProfileMod } from "@/extensions/profile_management/types/IProfile";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

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

const NO_MODS: { [modId: string]: IMod } = {};

const NO_MOD_STATE: { [modId: string]: IProfileMod } = {};

const NONE: ModInstallState = { kind: "none" };

/** Whether the Mods page offers an update in this state, as `offersUpdate` says. */
const isOffered = (state: UpdateState): state is "update" | "update-site" => offersUpdate(state);

/**
 * Whether a download is of the mod, by its Nexus ids. A download from an nxm link only gets its
 * domain once the archive's lookup finds it, which can fail, so until then it's its game's.
 */
const isDownloadOf = (
  download: IDownload | undefined,
  ref: INexusModRef,
  domainOf: IModInstallSources["domainOf"],
) => {
  const ids = download?.modInfo?.nexus?.ids;

  if (!ids || Number(ids.modId) !== ref.modId) {
    return false;
  }

  const [game] = download.game ?? [];
  const domain = ids.gameId ?? (game ? domainOf(VortexGameId(game)) : undefined);

  return domain === ref.domain;
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
  const all = Object.values(mods).filter((mod) => mod.type !== COLLECTION_TYPE);

  const isInstalling = all.some(
    (mod) =>
      mod.state === "installing" &&
      !!mod.archiveId &&
      isDownloadOf(downloads[mod.archiveId], ref, domainOf),
  );

  if (isInstalling) {
    return { kind: "installing" };
  }

  const installed: IModWithState[] = all
    .filter(
      (mod) =>
        mod.attributes?.source === "nexus" &&
        Number(mod.attributes?.modId) === ref.modId &&
        domainOf(VortexGameId(mod.attributes?.downloadGame ?? gameId)) === ref.domain,
    )
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
      isDownloadOf(downloads[id], ref, domainOf),
  );

  return downloadId ? { kind: "downloaded", downloadId } : { kind: "none" };
};

/** The key a mod's sources are grouped under: its domain and id. */
const modKey = (domain: GameDomain, modId: number) => `${domain}/${modId}`;

/** The Nexus Mods mod a download is of, by `isDownloadOf`'s rules; none for one that isn't. */
const downloadKey = (download: IDownload, domainOf: IModInstallSources["domainOf"]) => {
  const ids = download.modInfo?.nexus?.ids;

  if (!ids?.modId) {
    return undefined;
  }

  const [game] = download.game ?? [];
  const domain = ids.gameId ? GameDomain(ids.gameId) : game && domainOf(VortexGameId(game));

  return domain ? modKey(domain, Number(ids.modId)) : undefined;
};

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
 * The active game's mods and downloads split up by the Nexus Mods mod they're of, so a mod's
 * state looks through its own and not the whole game's. A mod is filed under its Nexus ids and
 * under the download it's installed from, as an install's mod only has its ids once it's done.
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
    const domain = domainOf(VortexGameId(mod.attributes?.downloadGame ?? gameId));
    const ownKey =
      mod.attributes?.source === "nexus" && domain
        ? modKey(domain, Number(mod.attributes?.modId))
        : undefined;
    const keys = new Set([ownKey, mod.archiveId ? downloadKeys[mod.archiveId] : undefined]);

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

/** Looks games' Nexus Mods domains up by id, each once, from the known games. */
const domainLookup = (games: IGameStored[]): IModInstallSources["domainOf"] => {
  const domains = new Map<VortexGameId, GameDomain | undefined>();

  return (id) => {
    if (!domains.has(id)) {
      domains.set(
        id,
        nexusGameId(
          games.find((game) => game.id === id),
          id,
        ),
      );
    }
    return domains.get(id);
  };
};

/** The known games' domains, looked up once each until the games change. */
const gameDomains = createSelector(knownGames, domainLookup);

/**
 * Each download's key. The same object until a key changes, so a download's progress, which
 * replaces the downloads on every tick, doesn't regroup the mods.
 */
export const downloadKeys = createSelector(
  [(state: IState) => state.persistent.downloads.files, gameDomains],
  downloadKeysOf,
  { memoizeOptions: { resultEqualityCheck: shallowEqual } },
);

/** The active game's mods and downloads by the mod they're of, grouped once per change. */
const modInstallGroups = createSelector(
  [activeGameId, (state: IState) => state.persistent.mods, downloadKeys, gameDomains],
  (active, modsByGame, keys, domainOf) =>
    active
      ? groupModInstallSources(modsByGame[active] ?? NO_MODS, keys, VortexGameId(active), domainOf)
      : undefined,
);

/**
 * What the user has of a mod in the active game; see `modInstallState`. Looks through only the
 * mod's own group, and compares field by field, so a download's progress doesn't re-render.
 */
export const useModInstallState = (ref: INexusModRef): ModInstallState =>
  useSelector((state: IState): ModInstallState => {
    const groups = modInstallGroups(state);
    const active = activeGameId(state);

    if (!groups || !active) {
      return NONE;
    }

    const gameId = VortexGameId(active);

    return groupedModInstallState(
      groups,
      {
        mods: state.persistent.mods[gameId] ?? NO_MODS,
        modState: activeProfile(state)?.modState ?? NO_MOD_STATE,
        downloads: state.persistent.downloads.files,
        gameId,
        domainOf: gameDomains(state),
      },
      ref,
    );
  }, shallowEqual);
