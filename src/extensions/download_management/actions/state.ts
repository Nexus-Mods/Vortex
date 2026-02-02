import { createAction } from "redux-act";
import type { IChunk } from "../types/IChunk";

import { log } from "../../../util/log";

export interface IDictionary {
  [key: string]: any;
}

/**
 * initialize a download (it may not be started immediately)
 */
export const initDownload = createAction(
  "INIT_DOWNLOAD",
  (id: string, urls: string[], modInfo: IDictionary, games: string[]) => ({
    id,
    urls,
    modInfo,
    games,
  }),
);

/**
 * set download progress (in percent)
 */
export const downloadProgress = createAction(
  "DOWNLOAD_PROGRESS",
  (
    id: string,
    received: number,
    total: number,
    chunks: IChunk[],
    urls: string[],
  ) => ({ id, received, total, chunks, urls }),
);

export const finalizingProgress = createAction(
  "FINALIZING_PROGRESS",
  (id: string, progress: number) => ({ id, progress }),
);

/**
 * set/change the file path
 */
export const setDownloadFilePath = createAction(
  "SET_DOWNLOAD_FILEPATH",
  (id: string, filePath: string) => ({ id, filePath }),
);

/**
 * mark the download as pausable or not
 */
export const setDownloadPausable = createAction(
  "SET_DOWNLOAD_PAUSABLE",
  (id: string, pausable: boolean) => ({ id, pausable }),
);

/**
 * mark download as started
 */
export const startDownload = createAction("START_DOWNLOAD", (id: string) => ({
  id,
}));

/**
 * mark download as finalizing, meaning the file has been downloaded fully,
 * during this phase checksums are calculated for example
 */
export const finalizingDownload = createAction(
  "FINALIZING_DOWNLOAD",
  (id: string) => ({ id }),
);

/**
 * mark download as finished
 */
export const finishDownload = createAction(
  "FINISH_DOWNLOAD",
  (id: string, state: "finished" | "failed" | "redirect", failCause: any) => ({
    id,
    state,
    failCause,
  }),
);

export const setDownloadHash = createAction(
  "SET_DOWNLOAD_HASH",
  (id: string, fileMD5: string) => ({ id, fileMD5 }),
);

export const setDownloadHashByFile = createAction(
  "SET_DOWNLOAD_HASH_BY_FILE",
  (fileName: string, fileMD5: string, fileSize: number) => ({
    fileName,
    fileMD5,
    fileSize,
  }),
);

/**
 * mark download paused
 */
export const pauseDownload = createAction(
  "PAUSE_DOWNLOAD",
  (id: string, paused: boolean, chunks: IChunk[]) => ({ id, paused, chunks }),
);

export const setDownloadInterrupted = createAction(
  "SET_DOWNLOAD_INTERRUPTED",
  (id: string, realReceived: number) => ({ id, realReceived }),
);

/**
 * remove a download (and associated file if any)
 */
export const removeDownload = createAction("REMOVE_DOWNLOAD", (id: string) => ({
  id,
}));

export const removeDownloadSilent = createAction(
  "REMOVE_DOWNLOAD_SILENT",
  (id: string) => ({ id }),
);

/**
 * sets the current download speed in bytes/second
 */
export const setDownloadSpeed = createAction(
  "SET_DOWNLOAD_SPEED",
  (speed) => speed,
  () => ({ forward: false, scope: "local" }),
);

export const setDownloadSpeeds = createAction(
  "SET_DOWNLOAD_SPEEDS",
  (speeds) => speeds,
);

/**
 * add a file that has been found on disk but where we weren't involved
 * in the download.
 */
export const addLocalDownload = createAction(
  "ADD_LOCAL_DOWNLOAD",
  (id: string, game: string, localPath: string, fileSize: number) => ({
    id,
    game,
    localPath,
    fileSize,
  }),
);

export const mergeDownloadModInfo = createAction(
  "MERGE_DOWNLOAD_MODINFO",
  (id: string, value: any) => ({ id, value }),
);

export const setDownloadModInfo = createAction(
  "SET_DOWNLOAD_MODINFO",
  (id: string, key: string, value: any) => {
    if (key === "game" && Array.isArray(value)) {
      const err = new Error();
      log("error", "setting invalid gameid", { game: value, stack: err.stack });
      value = value[0];
    }
    return { id, key, value };
  },
);

export const setDownloadInstalled = createAction(
  "SET_DOWNLOAD_INSTALLED",
  (id: string, gameId: string, modId: string) => ({ id, gameId, modId }),
);

export const setDownloadTime = createAction(
  "SET_DOWNLOAD_TIME",
  (id: string, time: number) => ({ id, time }),
);

export const setCompatibleGames = createAction(
  "SET_COMPATIBLE_GAMES",
  (id: string, games: string[]) => ({ id, games }),
);
