import { inspect } from "util";

import * as _ from "lodash";

import { actionsToPartialReducerSpec } from "../../../reducers/builder";
import { VerifierDropParent } from "../../../types/IExtensionContext";
import type { IStateDownloads } from "../../../types/IState";
import { terminate } from "../../../util/errorHandling";
import { objDiff, flatten } from "../../../util/util";
import * as action from "../actions/state";
import type { IDownload } from "../types/IDownload";

export const NUM_SPEED_DATA_POINTS = 30;

const stateActions = {
  initDownload: action.initDownload,
  downloadProgress: action.downloadProgress,
  finalizingProgress: action.finalizingProgress,
  setDownloadFilePath: action.setDownloadFilePath,
  setDownloadPausable: action.setDownloadPausable,
  setDownloadHash: action.setDownloadHash,
  setDownloadHashByFile: action.setDownloadHashByFile,
  setDownloadInterrupted: action.setDownloadInterrupted,
  startDownload: action.startDownload,
  finishDownload: action.finishDownload,
  finalizingDownload: action.finalizingDownload,
  setDownloadTime: action.setDownloadTime,
  pauseDownload: action.pauseDownload,
  setDownloadSpeed: action.setDownloadSpeed,
  setDownloadSpeeds: action.setDownloadSpeeds,
  removeDownload: action.removeDownload,
  removeDownloadSilent: action.removeDownloadSilent,
  addLocalDownload: action.addLocalDownload,
  setDownloadModInfo: action.setDownloadModInfo,
  mergeDownloadModInfo: action.mergeDownloadModInfo,
  setDownloadInstalled: action.setDownloadInstalled,
  setCompatibleGames: action.setCompatibleGames,
};

/** stores a download under its id, replacing whatever was there */
function putFile(state: IStateDownloads, id: string, file: IDownload): IStateDownloads {
  return { ...state, files: { ...state.files, [id]: file } };
}

/** changes a known download; returns the same state when there is no download under that id */
function updateFile(
  state: IStateDownloads,
  id: string,
  update: (file: IDownload) => IDownload,
): IStateDownloads {
  const file = state.files?.[id];
  return file === undefined ? state : putFile(state, id, update(file));
}

/** removes a download; returns the same state when there is no download under that id */
function removeFile(state: IStateDownloads, id: string): IStateDownloads {
  if (state.files === undefined || !Object.hasOwn(state.files, id)) {
    return state;
  }
  const { [id]: _removed, ...files } = state.files;
  return { ...state, files };
}

/**
 * sets a value at a key path inside a nested object, copying each level on the way and
 * creating missing ones as objects. A level that is an array is copied as an array.
 */
function setNested(level: unknown, keys: readonly string[], value: unknown): action.IDictionary {
  const [key, ...rest] = keys;
  const copy: action.IDictionary = Array.isArray(level) ? level.slice() : Object.assign({}, level);
  copy[key] =
    rest.length === 0 ? value : setNested(Object.hasOwn(copy, key) ? copy[key] : {}, rest, value);
  return copy;
}

/**
 * reducer for the downloads Vortex knows about. Partial: the core downloads reducer owns
 * checkpoints in the same slice.
 */
export const stateReducer = actionsToPartialReducerSpec<IStateDownloads, typeof stateActions>(
  {
    speed: 0,
    speedHistory: [],
    files: {},
  },
  stateActions,
  {
    initDownload: (state, payload) => {
      if (typeof payload.id !== "string") {
        throw new Error("invalid download id");
      }
      const downloadObj = {
        id: payload.id,
        state: "init" as const,
        game: payload.games,
        urls: payload.urls,
        modInfo: payload.modInfo,
        fileTime: Date.now(),
      };
      if (state.files[payload.id] != null) {
        const existing = state.files[payload.id];
        const delta = objDiff(existing, downloadObj, ["fileTime"]);
        // Flatten the delta to handle nested objects, then filter out nullish values
        const flattenedDelta = flatten(delta);
        const filteredDelta = Object.keys(flattenedDelta).reduce((acc, key) => {
          if (flattenedDelta[key] != null) {
            acc[key] = flattenedDelta[key];
          }
          return acc;
        }, {});
        if (Object.keys(filteredDelta).length === 0) {
          return state;
        }

        // The code that called this action can't continue using this id.
        // We rely on the calling code to have a reliable way of generating unique id so
        // it's not worth the effort to code error handling for this.
        terminate(
          {
            message: "Invalid state change",
            details:
              "An attempt was made to change application state in a way that " +
              "would destroy user data. The action was: 'initDownload' " +
              "with id '" +
              payload.id +
              "'. " +
              "This is a bug in the calling code, please report it.",
          },
          undefined,
        );
        return state;
      }
      // a new download has no size, progress or start time yet, which IDownload declares required
      return putFile(state, payload.id, downloadObj as IDownload);
    },
    downloadProgress: (state, payload) => {
      if (typeof payload.id !== "string") {
        throw new Error("invalid download id");
      }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      const update: Partial<IDownload> = {
        received: payload.received,
        size: payload.total,
      };
      if (state.files[payload.id].state === "init") {
        update.state = payload.received > 0 ? "started" : "init";
      }
      if (payload.urls !== undefined) {
        update.urls = payload.urls;
      }
      return putFile(state, payload.id, { ...state.files[payload.id], ...update });
    },
    finalizingProgress: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return putFile(state, payload.id, { ...state.files[payload.id], verified: payload.progress });
    },
    setDownloadFilePath: (state, payload) =>
      updateFile(state, payload.id, (file) => ({ ...file, localPath: payload.filePath })),
    setDownloadPausable: (state, payload) =>
      updateFile(state, payload.id, (file) => ({ ...file, pausable: payload.pausable })),
    setDownloadHash: (state, payload) =>
      updateFile(state, payload.id, (file) => ({ ...file, fileMD5: payload.fileMD5 })),
    setDownloadHashByFile: (state, payload) => {
      const downloadId = Object.keys(state.files || {}).find(
        (id: string) => state.files[id].localPath === payload.fileName,
      );
      if (downloadId === undefined) {
        return state;
      }
      if (typeof downloadId !== "string") {
        throw new Error("invalid download id");
      }
      return putFile(state, downloadId, {
        ...state.files[downloadId],
        fileMD5: payload.fileMD5,
        size: payload.fileSize,
      });
    },
    setDownloadInterrupted: (state, payload) => {
      if (typeof payload.id !== "string") {
        throw new Error("invalid download id");
      }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return putFile(state, payload.id, {
        ...state.files[payload.id],
        state: "paused",
        received: payload.realReceived,
      });
    },
    startDownload: (state, payload) => {
      if (typeof payload.id !== "string") {
        throw new Error("invalid download id");
      }
      if ((state.files?.[payload.id]?.state ?? "unknown") !== "init") {
        return state;
      }
      return putFile(state, payload.id, {
        ...state.files[payload.id],
        state: "started",
        startTime: Date.now(),
      });
    },
    finishDownload: (state, payload) => {
      if (typeof payload.id !== "string") {
        throw new Error("invalid download id");
      }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return putFile(state, payload.id, {
        ...state.files[payload.id],
        state: payload.state,
        failCause: payload.failCause,
        fileTime: Date.now(),
      });
    },
    finalizingDownload: (state, payload) => {
      if (state.files[payload.id] === undefined) {
        return state;
      }
      return putFile(state, payload.id, { ...state.files[payload.id], state: "finalizing" });
    },
    // creates the download's entry if it has none
    setDownloadTime: (state, payload) =>
      putFile(state, payload.id, { ...state.files?.[payload.id], fileTime: payload.time }),
    pauseDownload: (state, payload) => {
      const { id, paused } = payload;
      const oldDLState = state.files?.[id]?.state;
      if (
        ["finished", "finalizing", undefined].includes(oldDLState) ||
        (oldDLState === "failed" && paused)
      ) {
        // failed downloads can be retried, otherwise we only allow resuming paused and pausing
        // active downloads
        return state;
      }
      const newState = paused
        ? "paused"
        : (state.files?.[id]?.received ?? 0) > 0
          ? "started"
          : "init";
      const file = state.files[id];
      // Count each pause transition (the download is known and not final here, so the state
      // always changes). Persisted, so it accumulates across restarts; surfaced as pause_count.
      return putFile(
        state,
        id,
        paused
          ? { ...file, state: newState, pauseCount: (file.pauseCount ?? 0) + 1 }
          : { ...file, state: newState },
      );
    },
    setDownloadSpeed: (state, payload) => {
      let speeds = Array.isArray(state.speedHistory) ? state.speedHistory.slice() : [];
      speeds.push(payload);
      if (speeds.length > NUM_SPEED_DATA_POINTS) {
        speeds = speeds.slice(speeds.length - NUM_SPEED_DATA_POINTS);
      }
      return { ...state, speed: payload, speedHistory: speeds };
    },
    setDownloadSpeeds: (state, payload) => {
      let speeds = Array.isArray(payload) ? payload.slice() : [];
      if (speeds.length > NUM_SPEED_DATA_POINTS) {
        speeds = speeds.slice(speeds.length - NUM_SPEED_DATA_POINTS);
      }
      return { ...state, speed: speeds[speeds.length - 1] ?? 0, speedHistory: speeds };
    },
    removeDownload: (state, payload) => removeFile(state, payload.id),
    removeDownloadSilent: (state, payload) => removeFile(state, payload.id),
    addLocalDownload: (state, payload) =>
      // a download found on disk has no id field, start time or hash progress, which IDownload
      // declares required
      putFile(state, payload.id, {
        state: "finished",
        game: [payload.game],
        localPath: payload.localPath,
        size: payload.fileSize,
        received: payload.fileSize,
        fileTime: Date.now(),
        urls: [],
        modInfo: {},
      } as IDownload),
    setDownloadModInfo: (state, payload) => {
      if (typeof payload.id !== "string") {
        throw new Error("invalid download id: " + inspect(payload.id));
      }
      if (state.files[payload.id] === undefined) {
        return state;
      }
      const file = state.files[payload.id];
      return putFile(state, payload.id, {
        ...file,
        modInfo: setNested(file.modInfo, payload.key.split("."), payload.value),
      });
    },
    mergeDownloadModInfo: (state, payload) => {
      const { id, value } = payload;

      if (typeof id !== "string") {
        throw new Error("invalid download id");
      }

      if (state.files[payload.id] === undefined) {
        return state;
      }

      return putFile(state, id, {
        ...state.files[id],
        modInfo: _.merge(state.files[id]?.modInfo || {}, value),
      });
    },
    // creates the download's entry if it has none
    setDownloadInstalled: (state, payload) =>
      putFile(state, payload.id, {
        ...state.files?.[payload.id],
        installed: { gameId: payload.gameId, modId: payload.modId },
      }),
    // creates the download's entry if it has none
    setCompatibleGames: (state, payload) =>
      putFile(state, payload.id, { ...state.files?.[payload.id], game: payload.games }),
  },
  {
    speedHistory: {
      // A corrupted speedHistory (non-array, or longer than NUM_SPEED_DATA_POINTS)
      // used to crash the Downloads page render. Repair it on hydration so affected
      // users self-heal instead of staying broken even after the render-path fix.
      description: () => "Download speed history stored incorrectly will be repaired.",
      type: "array",
      repair: (input) => {
        if (!Array.isArray(input)) {
          return [];
        }
        return input.slice(-NUM_SPEED_DATA_POINTS);
      },
    },
    files: {
      // shouldn't be reported atm
      description: () => "Severe! Invalid list of archives",
      elements: {
        _: {
          // shouldn't be reported atm
          description: () => "Invalid download",
          elements: {
            game: {
              description: () => "Download to game assignment stored incorrectly will be repaired.",
              required: true,
              type: "array",
              noNull: true,
              noUndefined: true,
              /* Would be nice if we could check the game assignment for validity here, but
               * right now (as of 1.3.5), the main issue we're facing is downloads that have been
               * placed in the download base directory and those wouldn't be added again and thus
               * left orphaned, with no in-application way of removing them
              elements: {
                _:  {
                  description: () => 'Download to game assignment stored incorrectly will be repaired.',
                  noNull: true,
                  noUndefined: true,
                  deleteBroken: 'parent',
                },
              },
              */
              repair: (input) => {
                if (input !== undefined) {
                  return [input];
                } else {
                  throw new VerifierDropParent();
                }
              },
            },
          },
        },
      },
    },
  },
);
