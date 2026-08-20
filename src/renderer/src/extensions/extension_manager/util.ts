import * as path from "node:path";

import type { IGameListEntry } from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "@/logging";

import type {
  IAvailableExtension,
  IExtensionDownloadInfo,
  ISelector,
} from "../../types/extensions";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import { INVALID_FILENAME_RE } from "../../util/util";
import { setDownloadModInfo } from "../download_management/actions/state";
import { downloadPathForGame } from "../download_management/selectors";
import { SITE_ID } from "../gamemode_management/constants";
import { nexusGamesProm } from "../nexus_integration/util";
import { decodeUID, makeModUID } from "../nexus_integration/util/UIDs";
import {
  dedupeGameExtensions,
  fetchExtensionList,
  groupGameExtensionsByGameId,
} from "./availableExtensions";
import installExtension from "./installExtension";
import { findInCatalog } from "./queries";

let availableExtensionsCache: Promise<IAvailableExtension[]> | undefined;

export function selectorMatch(ext: IAvailableExtension, selector: ISelector): boolean {
  if (selector === undefined) {
    return false;
  }
  return ext.modId === selector.modId;
}

export function sanitize(input: string): string {
  return input.replace(INVALID_FILENAME_RE, "_");
}

/**
 * Fetch the extension list, memoized so concurrent callers share one request.
 * `force` refetches; a failed fetch clears the memo so the next call retries.
 */
export function fetchAvailableExtensions(
  api: IExtensionApi,
  force: boolean = false,
): Promise<IAvailableExtension[]> {
  if (availableExtensionsCache === undefined || force) {
    const fetching = doFetchAvailableExtensions(api);
    fetching.catch(() => {
      if (availableExtensionsCache === fetching) {
        availableExtensionsCache = undefined;
      }
    });
    availableExtensionsCache = fetching;
  }
  return availableExtensionsCache;
}

/** Fill in gameDomain/gameName from the local Nexus games list. */
function resolveGameInfo(
  extensions: IAvailableExtension[],
  games: IGameListEntry[],
): IAvailableExtension[] {
  // keyed by numeric Nexus Mods game ID
  const gameById = new Map<number, IGameListEntry>(games.map((game) => [game.id, game]));

  return extensions.map((ext) => {
    const game = ext.gameId !== undefined ? gameById.get(ext.gameId) : undefined;
    return game === undefined ? ext : { ...ext, gameDomain: game.domain_name, gameName: game.name };
  });
}

/**
 * Resolve endorsement counts for the games claimed by more than one extension,
 * so dedupeGameExtensions keeps the most endorsed claimant.
 */
async function resolveContestedEndorsements(
  api: IExtensionApi,
  extensions: IAvailableExtension[],
): Promise<Record<number, number>> {
  const contested = [...groupGameExtensionsByGameId(extensions).values()]
    .filter((group) => group.length > 1)
    .flat();
  if (contested.length === 0) return {};

  const uids = contested
    .map((ext) =>
      makeModUID({ gameId: SITE_ID, modId: String(ext.modId), fileId: String(ext.fileId) }),
    )
    .filter((uid) => uid !== undefined);

  // keyed by mod ID
  const endorsements: Record<number, number> = {};
  try {
    const byUid = (await api.ext.nexusGetModEndorsementCounts?.(uids)) ?? {};
    for (const [uid, count] of Object.entries(byUid)) {
      const decoded = decodeUID(uid);
      if (decoded !== undefined) endorsements[decoded.id] = count;
    }
  } catch (err) {
    // dedupe falls back to the newest upload
    log("warn", "failed to fetch endorsement counts for duplicate game extensions", {
      error: getErrorMessageOrDefault(err),
      contested: contested.length,
    });
  }
  return endorsements;
}

async function doFetchAvailableExtensions(api: IExtensionApi): Promise<IAvailableExtension[]> {
  const [fetched, games] = await Promise.all([fetchExtensionList(api), nexusGamesProm()]);
  const extensions = resolveGameInfo(fetched, games);
  const endorsements = await resolveContestedEndorsements(api, extensions);
  return dedupeGameExtensions(extensions, endorsements);
}

export async function downloadAndInstallExtension(
  api: IExtensionApi,
  ext: IExtensionDownloadInfo,
): Promise<boolean> {
  try {
    if (ext.modId === undefined) {
      return false;
    }

    const downloadIds = await downloadFromNexus(api, ext);
    if (downloadIds.length === 0) {
      throw new ProcessCanceled("No download found");
    }

    const downloadId = downloadIds[0];
    const download = api.getState().persistent.downloads.files[downloadId];

    api.store.dispatch(setDownloadModInfo(downloadId, "internal", true));

    // the catalog only provides metadata here; install the download without it
    let availableExtensions: IAvailableExtension[] = [];
    try {
      availableExtensions = await fetchAvailableExtensions(api);
    } catch (err) {
      log("warn", "failed to fetch extension list", { error: getErrorMessageOrDefault(err) });
    }

    const catalogEntry = findInCatalog(availableExtensions, { modId: ext.modId });

    const state = api.getState();
    const downloadPath = downloadPathForGame(state, SITE_ID);

    await installExtension(api, path.join(downloadPath, download.localPath), {
      catalogEntry,
      analytics: {
        source: "nexusmods",
        gameDomain: catalogEntry?.gameDomain,
        gameName: catalogEntry?.gameName,
      },
    });

    return true;
  } catch (err) {
    if (err instanceof UserCanceled) return false;
    log("error", "error installing extension", err);

    api.showDialog(
      "error",
      "Installation failed",
      {
        text:
          'Failed to install the extension "{{extensionName}}", ' +
          "please check the notifications.",
        parameters: {
          extensionName: ext.name,
        },
        options: {
          hideMessage: true,
        },
      },
      [{ label: "Close" }],
    );
    return false;
  }
}

const UPDATE_PREFIX = "Vortex Extension Update -";

function archiveFileName(ext: IExtensionDownloadInfo): string {
  const name = ext.name.startsWith("Game:")
    ? ext.name.replace("Game:", UPDATE_PREFIX)
    : UPDATE_PREFIX + " " + ext.name;
  return ext["version"] !== undefined
    ? `${sanitize(name)} v${ext["version"]}.7z`
    : `${sanitize(name)}.7z`;
}

async function downloadFromNexus(
  api: IExtensionApi,
  ext: IExtensionDownloadInfo,
): Promise<string[]> {
  log("debug", "download from nexus", archiveFileName(ext));
  return await api.emitAndAwait<"nexus-download">(
    "nexus-download",
    SITE_ID,
    ext.modId,
    ext.fileId,
    archiveFileName(ext),
    false,
  );
}
