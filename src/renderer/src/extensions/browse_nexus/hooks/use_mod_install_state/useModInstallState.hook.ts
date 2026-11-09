import { type GameDomain, VortexGameId } from "@vortex/shared";
import { shallowEqual, useSelector } from "react-redux";

import { MOD_TYPE as COLLECTION_TYPE } from "@/extensions/collections/constants";
import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { gameById } from "@/extensions/gamemode_management/selectors";
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

const NO_ACTIVE_GAME: ModInstallState = { kind: "none" };

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

  const [game] = download.game;
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
      downloads[id].game.includes(gameId) &&
      isDownloadOf(downloads[id], ref, domainOf),
  );

  return downloadId ? { kind: "downloaded", downloadId } : { kind: "none" };
};

/**
 * What the user has of a mod in the active game; see `modInstallState`. Compared field by field,
 * so a download's progress, which replaces the downloads on every tick, doesn't re-render.
 */
export const useModInstallState = (ref: INexusModRef): ModInstallState =>
  useSelector((state: IState): ModInstallState => {
    const active = activeGameId(state);

    if (!active) {
      return NO_ACTIVE_GAME;
    }

    const gameId = VortexGameId(active);

    return modInstallState(
      {
        mods: state.persistent.mods[gameId] ?? NO_MODS,
        modState: activeProfile(state)?.modState ?? NO_MOD_STATE,
        downloads: state.persistent.downloads.files,
        gameId,
        domainOf: (id) => nexusGameId(gameById(state, id), id),
      },
      ref,
    );
  }, shallowEqual);
