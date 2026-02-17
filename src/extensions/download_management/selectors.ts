import { activeGameId } from "../../extensions/profile_management/selectors";
import type { IDownload, IState } from "../../renderer/types/IState";
import { log } from "../../util/log";
import getDownloadPath from "./util/getDownloadPath";
import type { OutputParametricSelector } from "re-reselect";
import { createCachedSelector } from "re-reselect";
import { createSelector } from "reselect";
import type { DownloadState } from "./types/IDownload";

const downloadPathPattern = (state: IState) => state.settings.downloads.path;

type DLPathCB = (inPath: string, inGameId: string) => string;

export const downloadPath: (state: IState) => string = createSelector(
  downloadPathPattern,
  activeGameId,
  (inPath: string, inGameId: string) => getDownloadPath(inPath, inGameId),
);

const downloadPathForGameImpl: OutputParametricSelector<
  IState,
  string,
  string,
  DLPathCB,
  any
> = createCachedSelector(
  downloadPathPattern,
  (state: IState, gameId: string) => gameId,
  (inPath: string, gameId: string) => getDownloadPath(inPath, gameId),
)((state, gameId) => gameId);

export function downloadPathForGame(state: IState, gameId?: string) {
  return downloadPathForGameImpl(
    state,
    gameId ?? activeGameId(state) ?? "__invalid",
  );
}

const downloadFiles = (state: IState) => state.persistent.downloads.files;
export const downloadsForGame = (state: IState, gameId: string) => {
  return Object.keys(downloadFiles(state)).reduce(
    (prev, id) => {
      const download = downloadFiles(state)[id];
      if (
        download.game.includes(gameId) &&
        ["finished"].includes(download.state)
      ) {
        prev[id] = download;
      }
      return prev;
    },
    {} as { [dlId: string]: IDownload },
  );
};

export const downloadsForActiveGame = (state: IState) =>
  createSelector(activeGameId, (inGameId: string) =>
    downloadsForGame(state, inGameId),
  );

const ACTIVE_STATES: DownloadState[] = ["finalizing", "started"];

const QUEUE_CLEAR_STATES: DownloadState[] = ["started", "paused", "init"];
export const queueClearingDownloads = createSelector(
  downloadFiles,
  (files: { [dlId: string]: IDownload }) =>
    Object.keys(files).reduce((prev, id) => {
      if (QUEUE_CLEAR_STATES.includes(files[id].state)) {
        prev[id] = files[id];
      }
      return prev;
    }, {}),
);

export const activeDownloads = createSelector(
  downloadFiles,
  (files: { [dlId: string]: IDownload }) =>
    Object.keys(files).reduce((prev, id) => {
      if (ACTIVE_STATES.includes(files[id].state)) {
        prev[id] = files[id];
      }
      return prev;
    }, {}),
);

export const getDownloadByIds = createSelector(
  downloadFiles,
  (
    state: IState,
    identifiers: { fileId: number; modId: number; gameId: string },
  ) => identifiers,
  (
    files: { [dlId: string]: IDownload },
    identifiers: { fileId: number; modId: number; gameId: string },
  ) => {
    return Object.values(files).find((dl) => {
      if (dl.game.includes(identifiers.gameId) === false) {
        return false;
      }
      return (
        dl.modInfo?.nexus?.ids?.fileId === identifiers.fileId &&
        dl.modInfo?.nexus?.ids?.modId === identifiers.modId
      );
    });
  },
);
