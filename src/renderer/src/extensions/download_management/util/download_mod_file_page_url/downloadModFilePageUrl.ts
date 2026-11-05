import { gameById } from "@/extensions/gamemode_management/selectors";
import { nexusGameId, nxmPageId } from "@/extensions/nexus_integration/util/convertGameId";
import { nexusFilePageUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { IState } from "@/types/IState";

import type { IDownload } from "../../types/IDownload";
import getDownloadGames from "../getDownloadGames";

/**
 * A download's file page on Nexus Mods, from its Nexus ids or, failing those, its file metadata.
 * Undefined when the download carries neither.
 */
export function downloadModFilePageUrl(
  state: IState,
  download: IDownload | undefined,
): string | undefined {
  if (download === undefined) {
    return undefined;
  }

  // the ids' game is the nxm link's game id (queryDLInfo stores it from the link), which need not
  // be the game's domain
  const ids = download.modInfo?.nexus?.ids;
  if (ids?.gameId !== undefined && ids.modId !== undefined && ids.fileId !== undefined) {
    return nexusFilePageUrl(nxmPageId(state, ids.gameId), ids.modId, ids.fileId);
  }

  // the metadata has no domain, so the download's own game, a Vortex game id, is joined to one
  const details = download.modInfo?.meta?.details;
  const gameId = getDownloadGames(download)[0];
  if (details?.modId === undefined || details.fileId === undefined || gameId === undefined) {
    return undefined;
  }
  const domain = nexusGameId(gameById(state, gameId), gameId);
  return nexusFilePageUrl(domain, details.modId, details.fileId);
}
