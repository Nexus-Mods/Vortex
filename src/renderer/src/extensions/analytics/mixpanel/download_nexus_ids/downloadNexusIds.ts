import { type NexusGameDomain, type NexusGameId, VortexGameId } from "@vortex/shared";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { nexusIdsFromDownloadId } from "@/extensions/nexus_integration/selectors";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import type { IState } from "@/types/IState";

import { numericNexusGameId } from "../numericGameId";

/** A download's Nexus ids, from the game it's for. */
interface IDownloadGameIds {
  /** The Nexus Mods domain of the game the download is for. */
  gameDomainName: NexusGameDomain | undefined;
  fileId: string | undefined;
  modId: string | undefined;
  /** The Nexus Mods id of the game the download is for. */
  numericGameId: NexusGameId;
  collectionSlug: string | undefined;
  collectionId: string | undefined;
  revisionId: string | undefined;
}

/**
 * The Nexus ids from a download's record when it names no Nexus game yet, as an nxm download's
 * doesn't until its metadata lookup lands, which a small file finishes long before. The game is
 * the one the download is for, mapped as every analytics event's `game_id` is, so the ids agree
 * with it.
 *
 * Not `convertId`: it reads the stored game's `nexus` ids, which a game whose extension declares
 * no Nexus domain never gets (Stardew Valley's), so it would find nothing for those downloads.
 */
function idsFromDownloadGame(download: IDownload | undefined): IDownloadGameIds | undefined {
  const storedGameId = download?.game?.[0];
  const ids = download?.modInfo?.nexus?.ids;

  if (!storedGameId || !ids) {
    return undefined;
  }

  const vortexGameId = VortexGameId(storedGameId);
  const numericGameId = numericNexusGameId(vortexGameId);

  if (!numericGameId) {
    return undefined;
  }

  return {
    gameDomainName: nexusGameId(getGame(vortexGameId), vortexGameId),
    fileId: ids.fileId?.toString(),
    modId: ids.modId?.toString(),
    numericGameId,
    collectionSlug: ids.collectionSlug,
    collectionId: ids.collectionId?.toString(),
    revisionId: ids.revisionId?.toString(),
  };
}

/**
 * A download's Nexus ids for its analytics events: those its record names, else those from the
 * game it's for, so a download that finishes before its metadata lookup is still tracked.
 */
export const downloadNexusIds = (state: IState, downloadId: string) =>
  nexusIdsFromDownloadId(state, downloadId) ??
  idsFromDownloadGame(state.persistent.downloads.files?.[downloadId]);
