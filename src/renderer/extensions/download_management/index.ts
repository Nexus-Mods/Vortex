import type * as Redux from "redux";

import PromiseBB from "bluebird";
import * as _ from "lodash";
import Zip from "node-7z";
import * as path from "path";
import { generate as shortid } from "shortid";
import { fileMD5 } from "vortexmt";
import winapi from "winapi-bindings";

import type {
  IExtensionApi,
  IExtensionContext,
} from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import type { ITestResult } from "../../types/ITestResult";
import type { Normalize } from "../../util/getNormalizeFunc";
import type DownloadManager from "./DownloadManager";
import type { DownloadObserver } from "./DownloadObserver";
import type observe from "./DownloadObserver";
import type { DownloadState, IDownload } from "./types/IDownload";
import type { IProtocolHandlers, IResolvedURL } from "./types/ProtocolHandlers";
import type { IDownloadViewProps } from "./views/DownloadView";

import ReduxProp from "../../ReduxProp";
import { unknownToError } from "@vortex/shared";
import { getApplication } from "../../util/application";
import {
  DataInvalid,
  ProcessCanceled,
  UserCanceled,
} from "../../util/CustomErrors";
import Debouncer from "../../util/Debouncer";
import * as fs from "../../util/fs";
import getNormalizeFunc from "../../util/getNormalizeFunc";
import { log } from "../../util/log";
import * as selectors from "../../util/selectors";
import { knownGames } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch, sum, toPromise, truthy } from "../../util/util";
import NXMUrl from "../nexus_integration/NXMUrl";
import { ensureLoggedIn } from "../nexus_integration/util";
import {
  convertNXMIdReverse,
  convertGameIdReverse,
} from "../nexus_integration/util/convertGameId";
import {
  addLocalDownload,
  downloadProgress,
  removeDownload,
  removeDownloadSilent,
  setDownloadHash,
  setDownloadHashByFile,
  setDownloadInterrupted,
  setDownloadModInfo,
  setDownloadSpeed,
  setDownloadSpeeds,
} from "./actions/state";
import { setTransferDownloads } from "./actions/transactions";
import downloadAttributes from "./downloadAttributes";
import { settingsReducer } from "./reducers/settings";
import { stateReducer } from "./reducers/state";
import { transactionsReducer } from "./reducers/transactions";
import { ensureDownloadsDirectory } from "./util/downloadDirectory";
import extendAPI from "./util/extendApi";
import getDownloadGames from "./util/getDownloadGames";
import { finalizeDownload } from "./util/postprocessDownload";
import queryInfo from "./util/queryDLInfo";
import setDownloadGames from "./util/setDownloadGames";
import DownloadView from "./views/DownloadView";
import Settings from "./views/Settings";
import ShutdownButton from "./views/ShutdownButton";
import SpeedOMeter from "./views/SpeedOMeter";
import { mdiDownload } from "@mdi/js";

let observer: DownloadObserver;
let manager: DownloadManager;
let updateDebouncer: Debouncer;

const protocolHandlers: IProtocolHandlers = {};

const archiveExtLookup = new Set<string>([
  ".zip",
  ".z01",
  ".7z",
  ".rar",
  ".r00",
  ".001",
  ".bz2",
  ".bzip2",
  ".gz",
  ".gzip",
  ".xz",
  ".z",
  ".fomod",
  ".dazip",
]);

const addLocalInProgress = new Set<string>();

function withAddInProgress(
  fileName: string,
  cb: () => PromiseLike<void>,
): PromiseLike<void> {
  addLocalInProgress.add(fileName);
  return PromiseBB.resolve(cb()).finally(() => {
    addLocalInProgress.delete(fileName);
  });
}

function knownArchiveExt(filePath: string): boolean {
  if (!truthy(filePath)) {
    return false;
  }
  return archiveExtLookup.has(path.extname(filePath).toLowerCase());
}

function refreshDownloads(
  downloadPath: string,
  knownDLs: string[],
  normalize: (input: string) => string,
  onAddDownload: (name: string) => PromiseBB<void>,
  onRemoveDownload: (name: string) => PromiseBB<void>,
  confirmElevation: () => PromiseBB<void>,
) {
  return fs
    .ensureDirWritableAsync(downloadPath, confirmElevation)
    .then(() => fs.readdirAsync(downloadPath))
    .filter((filePath: string) => knownArchiveExt(filePath))
    .filter((filePath: string) =>
      fs
        .statAsync(path.join(downloadPath, filePath))
        .then((stat) => !stat.isDirectory())
        .catch(() => false),
    )
    .then((downloadNames: string[]) => {
      const dlsNormalized = downloadNames.map(normalize);
      const addedDLs = downloadNames.filter(
        (name: string, idx: number) =>
          knownDLs.indexOf(dlsNormalized[idx]) === -1,
      );
      const removedDLs = knownDLs.filter(
        (name: string) => dlsNormalized.indexOf(name) === -1,
      );

      return PromiseBB.map(addedDLs, onAddDownload).then(() =>
        PromiseBB.map(removedDLs, onRemoveDownload),
      );
    });
}

export type ProtocolHandler = (
  inputUrl: string,
  name: string,
) => PromiseBB<IResolvedURL>;

export interface IExtensionContextExt extends IExtensionContext {
  // register a download protocol handler
  // TODO: these kinds of handlers are rather limited as they can only return
  // ftp/http/https urls that can be downloaded directly, you can't add
  // meta information about the file.
  registerDownloadProtocol: (schema: string, handler: ProtocolHandler) => void;
}

function attributeExtractor(input: any) {
  let downloadGame: string | string[] = getSafe(
    input,
    ["download", "game"],
    [],
  );
  if (Array.isArray(downloadGame)) {
    downloadGame = downloadGame[0];
  }
  const logicalFileName =
    input?.meta?.logicalFileName || input?.download?.modInfo?.name;
  return PromiseBB.resolve({
    fileName: getSafe(input, ["download", "localPath"], undefined),
    fileMD5: getSafe(input, ["download", "fileMD5"], undefined),
    fileSize: getSafe(input, ["download", "size"], undefined),
    source: getSafe(input, ["download", "modInfo", "source"], undefined),
    version:
      getSafe(input, ["download", "modInfo", "version"], undefined) ??
      getSafe(input, ["download", "modInfo", "meta", "fileVersion"], undefined),
    logicalFileName,
    modId: getSafe(input, ["download", "modInfo", "ids", "modId"], undefined),
    fileId: getSafe(input, ["download", "modInfo", "ids", "fileId"], undefined),
    downloadGame,
  });
}

function attributeExtractorCustom(input: any) {
  return PromiseBB.resolve(input.download?.modInfo?.custom || {});
}

function genDownloadChangeHandler(
  api: IExtensionApi,
  currentDownloadPath: string,
  gameId: string,
  nameIdMap: { [name: string]: string },
  normalize: Normalize,
) {
  const updateTimers: { [fileName: string]: NodeJS.Timeout } = {};

  const store: Redux.Store<any> = api.store;

  const findDownload = (fileName: string): string => {
    const state = store.getState();
    return Object.keys(state.persistent.downloads.files).find(
      (iterId) =>
        state.persistent.downloads.files[iterId].localPath === fileName,
    );
  };

  return (evt: string, fileName: string) => {
    if (!watchEnabled || fileName === undefined || !knownArchiveExt(fileName)) {
      return;
    }

    if (evt === "update") {
      if (updateTimers[fileName] !== undefined) {
        clearTimeout(updateTimers[fileName]);
        setTimeout(() => {
          fs.statAsync(path.join(currentDownloadPath, fileName)).then(
            (stats) => {
              const dlId = findDownload(fileName);
              if (dlId !== undefined) {
                store.dispatch(
                  downloadProgress(dlId, stats.size, stats.size, [], undefined),
                );
              }
            },
          );
        }, 1000);
      }
    } else if (evt === "rename") {
      if (addLocalInProgress.has(fileName)) {
        return;
      }
      // this delay is intended to prevent this from picking up files that Vortex added itself.
      // It is not enough however to prevent this from getting the wrong file size if the file
      // copy/write takes more than this one second.
      PromiseBB.delay(1000)
        .then(() => fs.statAsync(path.join(currentDownloadPath, fileName)))
        .then((stats) => {
          let dlId = findDownload(fileName);
          if (dlId === undefined) {
            dlId = shortid();
            log(
              "debug",
              "file added to download directory at runtime",
              fileName,
            );
            store.dispatch(
              addLocalDownload(dlId, gameId, fileName, stats.size),
            );
            api.events.emit("did-import-downloads", [dlId]);
          }
          nameIdMap[normalize(fileName)] = dlId;
        })
        .catch((err) => {
          const normName = normalize(fileName);
          // in the past we used the nameIdMap to resolve the download id but that is
          // probably an unnecessary optimization that may just lead to errors
          if (err.code === "ENOENT") {
            // if the file was deleted, remove it from state. This does nothing if
            // the download was already removed so that's fine
            const dlId = findDownload(fileName);
            if (dlId !== undefined) {
              store.dispatch(removeDownload(dlId));
            }
            delete nameIdMap[normName];
          }
        });
    }
  };
}

let currentWatch: fs.FSWatcher;
let watchEnabled: boolean = true;

function watchDownloads(
  api: IExtensionApi,
  downloadPath: string,
  onChange: (evt: string, fileName: string) => void,
) {
  if (currentWatch !== undefined) {
    currentWatch.close();
  }

  try {
    currentWatch = fs.watch(downloadPath, {}, onChange);
    currentWatch.on("error", (error) => {
      // these may happen when the download path gets moved.
      log("warn", "failed to watch mod directory", { downloadPath, error });
    });
  } catch (err) {
    api.showErrorNotification(
      "Can't watch the download directory for changes",
      err,
      {
        allowReport: false,
      },
    );
  }
}

async function removeInvalidDownloads(api: IExtensionApi, gameId?: string) {
  const state: IState = api.store.getState();
  gameId = gameId || selectors.activeGameId(state);
  if (!gameId) {
    return;
  }
  const downloadPath = selectors.downloadPathForGame(state, gameId);
  const downloads: { [id: string]: IDownload } =
    state.persistent.downloads.files;

  const incomplete = Object.keys(downloads).filter(
    (dlId) =>
      ["finished", "paused", "failed"].includes(downloads[dlId].state) &&
      (!downloads[dlId].localPath ||
        downloads[dlId].received === 0 ||
        downloads[dlId].size === 0),
  );
  const invalid = Object.keys(downloads).filter(
    (dlId) =>
      downloads[dlId].localPath && !path.extname(downloads[dlId].localPath),
  );
  const removeSet = new Set<string>(incomplete.concat(invalid));

  const toRemove: string[] = [];
  const repairActions: Array<ReturnType<typeof downloadProgress>> = [];

  await Promise.all(
    Array.from(removeSet).map(async (dlId) => {
      if (downloads[dlId].localPath === undefined) {
        toRemove.push(dlId);
        return;
      }
      const filePath = path.join(downloadPath, downloads[dlId].localPath);
      const stats = await fs.statAsync(filePath).catch(() => undefined);
      if (stats?.size > 0) {
        // file exists and is valid on disk - repair the state instead of deleting
        repairActions.push(
          downloadProgress(dlId, stats.size, stats.size, [], undefined),
        );
      } else {
        // file genuinely missing or empty - safe to clean up
        await fs.removeAsync(filePath).catch(() => null);
        toRemove.push(dlId);
      }
    }),
  );
  batchDispatch(api.store, [
    ...repairActions,
    ...toRemove.map((dlId) => removeDownloadSilent(dlId)),
  ]);
}

function removeInvalidFileExts(api: IExtensionApi, gameId?: string) {
  const state: IState = api.store.getState();
  gameId = gameId || selectors.activeGameId(state);
  if (!gameId) {
    return PromiseBB.resolve();
  }
  const downloadPath = selectors.downloadPathForGame(state, gameId);
  return fs
    .readdirAsync(downloadPath)
    .then((files: string[]) => {
      return PromiseBB.all(
        files.map((fileName) => {
          if (!knownArchiveExt(fileName)) {
            return fs
              .removeAsync(path.join(downloadPath, fileName))
              .catch(() => null);
          }
        }),
      );
    })
    .catch((err) =>
      ["ENOENT", "EACCES", "EPERM"].includes(err.code)
        ? null
        : log("warn", "failed to remove invalid download files", err),
    );
}

function updateDownloadPath(api: IExtensionApi, gameId?: string) {
  const state: IState = api.store.getState();
  if (gameId === undefined) {
    gameId = selectors.activeGameId(state);
    if (gameId === undefined) {
      return PromiseBB.resolve();
    }
  }
  const currentDownloadPath = selectors.downloadPathForGame(state, gameId);

  let nameIdMap: { [name: string]: string } = {};
  let downloads = {};
  let downloadChangeHandler: (evt: string, fileName: string) => void;
  return (removeInvalidDownloads(api, gameId) as any)
    .then(() => removeInvalidFileExts(api, gameId))
    .then(() =>
      getNormalizeFunc(currentDownloadPath, {
        separators: false,
        relative: false,
      }),
    )
    .then((normalize) => {
      downloads = api.getState().persistent.downloads.files;
      nameIdMap = Object.keys(downloads).reduce((prev, value) => {
        if (downloads[value].localPath !== undefined) {
          prev[normalize(downloads[value].localPath)] = value;
        }
        return prev;
      }, {});

      downloadChangeHandler = genDownloadChangeHandler(
        api,
        currentDownloadPath,
        gameId,
        nameIdMap,
        normalize,
      );

      const knownDLs = Object.keys(downloads)
        .filter((dlId) => getDownloadGames(downloads[dlId])[0] === gameId)
        .map((dlId) => normalize(downloads[dlId].localPath || ""));

      return refreshDownloads(
        currentDownloadPath,
        knownDLs,
        normalize,
        (fileName: string) =>
          fs
            .statAsync(path.join(currentDownloadPath, fileName))
            .then((stats: fs.Stats) => {
              const dlId = shortid();
              log("debug", "registering previously unknown archive", fileName);
              api.store.dispatch(
                addLocalDownload(dlId, gameId, fileName, stats.size),
              );
              nameIdMap[normalize(fileName)] = dlId;
            }),
        (fileName: string) => {
          // the fileName here is already normalized
          api.store.dispatch(removeDownload(nameIdMap[fileName]));
          return PromiseBB.resolve();
        },
        () =>
          new PromiseBB((resolve, reject) => {
            api.showDialog(
              "question",
              "Access Denied",
              {
                text:
                  "The download directory is not writable to your user account.\n" +
                  "If you have admin rights on this system, Vortex can change the permissions " +
                  "to allow it write access.",
              },
              [
                { label: "Cancel", action: () => reject(new UserCanceled()) },
                { label: "Allow access", action: () => resolve() },
              ],
            );
          }),
      )
        .catch(UserCanceled, () => null)
        .catch((err) => {
          api.showErrorNotification(
            "Failed to refresh download directory",
            err,
            {
              allowReport: err.code !== "EPERM",
            },
          );
        });
    })
    .then(() => {
      manager.setDownloadPath(currentDownloadPath);
      watchDownloads(api, currentDownloadPath, downloadChangeHandler);
      api.events.emit("downloads-refreshed");
    })
    .then(() => checkDownloadsWithMissingMeta(api))
    .catch((err) => {
      api.showErrorNotification("Failed to read downloads directory", err, {
        allowReport: err.code !== "ENOENT",
      });
    });
}

function testDownloadPath(api: IExtensionApi): PromiseBB<void> {
  return ensureDownloadsDirectory(api)
    .catch(ProcessCanceled, () => PromiseBB.resolve())
    .catch(UserCanceled, () => PromiseBB.resolve())
    .catch((err) => {
      const errTitle =
        err.code === "EPERM"
          ? "Insufficient permissions"
          : "Downloads folder error";

      return new PromiseBB<void>((resolve) => {
        api.showDialog(
          "error",
          errTitle,
          {
            text:
              "Unable to finalize downloads folder creation/transfer. Please ensure your OS " +
              "account has full read/write permissions for the target destination and try again. " +
              "An exception should be added to Anti-Virus apps for Vortex. (where applicable)",
            message: err.message,
          },
          [{ label: "Retry", action: () => resolve() }],
        );
      }).then(() => testDownloadPath(api));
    });
}

function genGameModeActivated(api: IExtensionApi) {
  return () => testDownloadPath(api).then(() => updateDebouncer.schedule());
}

function removeArchive(store: Redux.Store<IState>, destination: string) {
  return fs.removeAsync(destination).then(() => {
    const state = store.getState();
    const fileName = path.basename(destination);
    const { files } = state.persistent.downloads;
    Object.keys(files)
      .filter((dlId) => files[dlId].localPath === fileName)
      .forEach((dlId) => {
        store.dispatch(removeDownload(dlId));
      });
  });
}

function queryReplace(api: IExtensionApi, destination: string) {
  return api
    .showDialog(
      "question",
      "File exists",
      {
        text: "This file already exists, do you want to replace it?",
        message: destination,
      },
      [{ label: "Cancel" }, { label: "Replace" }],
    )
    .then((result) =>
      result.action === "Cancel"
        ? PromiseBB.reject(new UserCanceled())
        : removeArchive(api.store, destination),
    );
}

function processInstallError(
  api: IExtensionApi,
  error: any,
  downloadId: string,
  archiveName: string,
) {
  // This installation error handling function is intended to be used to
  //  handle installation errors that are obfuscated for some reason, and
  //  the installManager's error handling is not sufficient or is unable
  //  to relay certain pieces of information to the user.
  if (error instanceof DataInvalid) {
    const downloadExists =
      api.getState().persistent.downloads.files[downloadId] !== undefined;
    if (!downloadExists) {
      error["message"] =
        "Vortex attempted to install a mod archive which is no longer available " +
        "in its internal state - this usually happens if the archive was scheduled " +
        "to be installed but was removed before the installation was able to start.";
      error["archiveName"] = archiveName;
      api.showErrorNotification("Install Failed", error, {
        allowReport: false,
      });
    }
  }
}

function postImport(
  api: IExtensionApi,
  destination: string,
  fileSize: number,
  silent: boolean,
): PromiseBB<string> {
  const store = api.store;
  const gameMode = selectors.activeGameId(store.getState());
  if (gameMode === undefined) {
    return PromiseBB.reject(new Error("no active game"));
  }

  const dlId = shortid();
  const fileName = path.basename(destination);

  log("debug", "import local download", destination);
  // do this after copy is completed, otherwise code watching for the event may be
  // trying to access the file already
  store.dispatch(addLocalDownload(dlId, gameMode, fileName, fileSize));
  return fs
    .statAsync(destination)
    .then((stats) => {
      store.dispatch(
        downloadProgress(dlId, stats.size, stats.size, [], undefined),
      );
      return toPromise((cb) =>
        api.events.emit("did-import-downloads", [dlId], cb),
      );
    })
    .then(() => {
      if (!silent) {
        api.sendNotification({
          id: `ready-to-install-${dlId}`,
          type: "success",
          title: "File imported",
          group: "download-finished",
          message: fileName,
          actions: [
            {
              title: "Install All",
              action: (dismiss) => {
                api.events.emit(
                  "start-install-download",
                  dlId,
                  undefined,
                  (err, mId) => {
                    if (err) {
                      processInstallError(api, err, dlId, fileName);
                    }
                  },
                );
                dismiss();
              },
            },
          ],
        });
      }

      return dlId;
    })
    .catch((err) => {
      store.dispatch(removeDownload(dlId));
      log("info", "failed to copy", { error: err.message });
      return undefined;
    });
}

function move(
  api: IExtensionApi,
  source: string,
  destination: string,
  silent: boolean,
): PromiseBB<string> {
  const notiId = silent
    ? undefined
    : api.sendNotification({
        type: "activity",
        title: "Importing file",
        message: path.basename(destination),
      });
  let fileSize: number;
  const fileName = path.basename(destination);
  addLocalInProgress.add(fileName);
  return fs
    .statAsync(destination)
    .catch(() => undefined)
    .then((stats: fs.Stats) => {
      if (stats !== undefined) {
        fileSize = stats.size;
      }
      return stats !== undefined ? queryReplace(api, destination) : null;
    })
    .then(() => fs.copyAsync(source, destination))
    .then(() => postImport(api, destination, fileSize, silent))
    .catch((err) => {
      api.showErrorNotification("Import Failed", err, { allowReport: false });
      log("info", "failed to copy", { error: err.message });
      return undefined;
    })
    .finally(() => {
      if (notiId !== undefined) {
        api.dismissNotification(notiId);
      }
      addLocalInProgress.delete(fileName);
    });
}

function importDirectory(
  api: IExtensionApi,
  source: string,
  destination: string,
  silent: boolean,
) {
  const zipper = new Zip();

  const notiId = silent
    ? undefined
    : api.sendNotification({
        type: "activity",
        title: "Importing file",
        message: path.basename(destination),
      });

  const fileName = path.basename(destination);
  addLocalInProgress.add(fileName);

  return fs
    .readdirAsync(source)
    .then((files) =>
      zipper.add(
        destination,
        files.map((name) => path.join(source, name)),
      ),
    )
    .then(() => fs.statAsync(destination))
    .then((stat: fs.Stats) => postImport(api, destination, stat.size, silent))
    .catch((err) => {
      api.showErrorNotification("Import Failed", err, { allowReport: false });
      log("info", "failed to copy", { error: err.message });
      return undefined;
    })
    .finally(() => {
      if (notiId !== undefined) {
        api.dismissNotification(notiId);
      }
      addLocalInProgress.delete(fileName);
    });
}

function genImportDownloadsHandler(api: IExtensionApi) {
  return (
    downloadPaths: string[],
    cb?: (dlIds: string[]) => void,
    silent?: boolean,
  ) => {
    const state = api.getState();
    const gameMode = selectors.activeGameId(state);

    if (gameMode === undefined) {
      log(
        "warn",
        "can't import download(s) when no game is active",
        downloadPaths,
      );
      return;
    }

    log("debug", "importing download(s)", downloadPaths);
    const downloadPath = selectors.downloadPathForGame(state, gameMode);
    PromiseBB.map(downloadPaths, (dlPath) => {
      const fileName = path.basename(dlPath);
      let destination = path.join(downloadPath, fileName);
      return fs
        .statAsync(dlPath)
        .then((stats: fs.Stats) => {
          if (stats.isDirectory()) {
            destination += ".7z";
            return importDirectory(api, dlPath, destination, silent ?? false);
          } else {
            return move(api, dlPath, destination, silent ?? false);
          }
        })
        .tap((dlId: string) => {
          log("info", "imported archives", { count: downloadPaths.length });
          return dlId;
        })
        .catch((err) => {
          api.sendNotification({
            type: "warning",
            title: err.code === "ENOENT" ? "File doesn't exist" : err.message,
            message: dlPath,
          });
        });
    }).then((dlIds: string[]) => {
      cb?.(dlIds.filter((id) => id !== undefined));
    });
  };
}

function checkPendingTransfer(api: IExtensionApi): PromiseBB<ITestResult> {
  let result: ITestResult;
  const state = api.store.getState();

  const gameMode = selectors.activeGameId(state);
  if (gameMode === undefined) {
    return PromiseBB.resolve(result);
  }

  const pendingTransfer: string[] = [
    "persistent",
    "transactions",
    "transfer",
    "downloads",
  ];
  const transferDestination = getSafe(state, pendingTransfer, undefined);
  if (transferDestination === undefined) {
    return PromiseBB.resolve(result);
  }

  result = {
    severity: "warning",
    description: {
      short: "Folder transfer was interrupted",
      long:
        "An attempt to move the download folder was interrupted. You should let " +
        "Vortex clean up now, otherwise you may be left with unnecessary copies of files.",
    },
    automaticFix: () =>
      new PromiseBB<void>((fixResolve, fixReject) => {
        api.sendNotification({
          id: "transfer-cleanup",
          message: "Cleaning up interrupted transfer",
          type: "activity",
        });
        // the transfer works by either copying the files or creating hard links
        // and only deleting the source when everything is transferred successfully,
        // so in case of an interrupted transfer we can always just delete the
        // incomplete target because the source is still there
        return fs
          .removeAsync(transferDestination)
          .then(() => {
            api.store.dispatch(setTransferDownloads(undefined));
            fixResolve();
          })
          .catch((err) => {
            if (err.code === "ENOENT") {
              // Destination is already gone, that's fine.
              api.store.dispatch(setTransferDownloads(undefined));
              fixResolve();
            } else {
              fixReject(err);
            }
          })
          .finally(() => {
            api.dismissNotification("transfer-cleanup");
          });
      }),
  };

  return PromiseBB.resolve(result);
}

let shutdownPending: boolean = false;
let shutdownInitiated: boolean = false;

/**
 * schedule or abort shutdown as necessary. This gets called constantly as downloads
 * are happening, the shutdown is sheduled when there are no active downloads, it's
 * canceled when new downloads are started
 */
function updateShutdown(downloads: { [key: string]: IDownload }) {
  if (
    shutdownInitiated &&
    (Object.keys(downloads).length > 0 || !shutdownPending)
  ) {
    // cancel shutdown if the conditions for it are no longer met
    winapi.AbortSystemShutdown();
    shutdownInitiated = false;
  }

  if (
    !shutdownInitiated &&
    shutdownPending &&
    Object.keys(downloads).length === 0
  ) {
    // schedule shutdown if conditions are met
    winapi.InitiateSystemShutdown(
      "Vortex downloads finished",
      30,
      false,
      false,
    );
    shutdownInitiated = true;
  }
}

function toggleShutdown(api: IExtensionApi) {
  if (shutdownPending) {
    shutdownPending = false;
    updateShutdown(selectors.activeDownloads(api.getState()));
  } else {
    api.showDialog(
      "question",
      "Confirm Shutdown",
      {
        text:
          "Your computer will be shut down 30 seconds after the last download finished. " +
          "Please make sure you've saved all your work in all running applications.\n" +
          "You can cancel this at any time by pressing the button again.",
      },
      [
        { label: "Cancel" },
        {
          label: "Schedule Shutdown",
          action: () => {
            shutdownPending = true;
            updateShutdown(selectors.activeDownloads(api.getState()));
          },
        },
      ],
    );
  }
}

function checkForUnfinalized(
  api: IExtensionApi,
  downloads: { [id: string]: IDownload },
  gameMode: string,
) {
  const unfinalized = Object.keys(downloads).filter(
    (id) =>
      (downloads[id].state === "finalizing" ||
        (downloads[id].state === "finished" &&
          downloads[id].fileMD5 === undefined)) &&
      downloads[id].localPath !== undefined,
  );

  if (unfinalized.length > 0) {
    api.sendNotification({
      type: "error",
      title: "Some downloads were not finalized",
      message: "Vortex may appear frozen for a moment while repairing this.",
      actions: [
        {
          title: "Repair",
          action: (dismiss) => {
            dismiss();

            const notiId = shortid();
            let completed = 0;

            const progress = (title: string) => {
              api.sendNotification({
                id: notiId,
                type: "activity",
                title: "Finalizing downloads",
                message: title,
                progress: (completed * 100) / unfinalized.length,
              });
            };

            progress("...");

            PromiseBB.map(
              unfinalized,
              (id) => {
                const gameId = Array.isArray(downloads[id].game)
                  ? convertGameIdReverse(
                      knownGames(api.getState()),
                      downloads[id].game[0],
                    )
                  : gameMode;
                const downloadPath = selectors.downloadPathForGame(
                  api.getState(),
                  gameId,
                );
                const filePath = path.join(
                  downloadPath,
                  downloads[id].localPath,
                );
                progress(downloads[id].localPath);
                if (downloads[id].state === "finalizing") {
                  return finalizeDownload(api, id, filePath)
                    .catch((err) => {
                      log("warn", "failed to properly finalize download", {
                        fileName: downloads[id].localPath,
                        error: err.message,
                      });
                    })
                    .finally(() => ++completed);
                } else {
                  return toPromise<string>((cb) =>
                    fileMD5(filePath, cb, () => {}),
                  )
                    .then((md5sum) => {
                      api.store.dispatch(setDownloadHash(id, md5sum));
                    })
                    .catch((err) => {
                      if (err.code === "ENOENT") {
                        // file doesn't exist, remove invalid download entry
                        api.store.dispatch(removeDownload(id));
                      } else {
                        log("error", "failed to calculate hash for download", {
                          file: downloads[id].localPath,
                          error: err.message,
                        });
                      }
                    })
                    .finally(() => ++completed);
                }
              },
              { concurrency: 4 },
            ).then(() => {
              api.dismissNotification(notiId);
            });
          },
        },
      ],
    });
  }
}

function removeDownloadsWithoutFile(
  store: Redux.Store,
  downloads: { [id: string]: IDownload },
) {
  // remove downloads that have no localPath set because they just cause trouble. They shouldn't
  // exist at all
  Object.keys(downloads)
    .filter((dlId) => !truthy(downloads[dlId].localPath))
    .forEach((dlId) => {
      store.dispatch(removeDownloadSilent(dlId));
    });
}

function processInterruptedDownloads(
  api: IExtensionApi,
  downloads: { [dlId: string]: IDownload },
  gameMode: string,
) {
  const interruptedDownloads = Object.keys(downloads).filter((id) =>
    ["init", "started", "pending"].includes(downloads[id].state),
  );
  interruptedDownloads.forEach((id) => {
    if (!truthy(downloads[id].urls)) {
      // download was interrupted before receiving urls, has to be canceled
      log("info", "download removed because urls were never retrieved", { id });
      const gameId = Array.isArray(downloads[id].game)
        ? convertGameIdReverse(
            knownGames(api.getState()),
            downloads[id].game[0],
          )
        : gameMode;

      const downloadPath = selectors.downloadPathForGame(
        api.getState(),
        gameId,
      );
      if (downloadPath !== undefined && downloads[id].localPath !== undefined) {
        fs.removeAsync(path.join(downloadPath, downloads[id].localPath)).then(
          () => {
            api.store.dispatch(removeDownloadSilent(id));
          },
        );
      } else {
        api.store.dispatch(removeDownloadSilent(id));
      }
    } else {
      let realSize =
        downloads[id].size !== 0
          ? downloads[id].size -
            sum((downloads[id].chunks || []).map((chunk) => chunk.size))
          : 0;
      if (isNaN(realSize)) {
        realSize = 0;
      }
      api.store.dispatch(setDownloadInterrupted(id, realSize));
    }
  });
}

function checkDownloadsWithMissingMeta(api: IExtensionApi) {
  const state = api.getState();
  const downloads = state.persistent.downloads.files ?? {};

  const missingInfo = Object.keys(downloads).filter(
    (dlId) => downloads[dlId].modInfo?.source === undefined,
  );

  if (missingInfo.length > 0) {
    log("info", "downloads missing meta information", { dlIds: missingInfo });
    queryInfo(api, missingInfo, false);
  } else {
    log("debug", "no missing meta information");
  }
}

function processCommandline(api: IExtensionApi) {
  const state = api.getState();

  const { commandLine } = state.session.base;

  const cliUrl = commandLine.download ?? commandLine.install;
  if (cliUrl) {
    api.events.emit(
      "start-download-url",
      cliUrl,
      undefined,
      commandLine.install !== undefined,
    );
  }

  const arcPath = commandLine.installArchive;
  if (typeof arcPath === "string" && path.isAbsolute(arcPath)) {
    api.events.emit("import-downloads", [arcPath], (dlIds: string[]) => {
      dlIds.forEach((dlId) => {
        api.events.emit("start-install-download", dlId);
      });
    });
  }
}

function init(context: IExtensionContextExt): boolean {
  const downloadCount = new ReduxProp(
    context.api,
    [["persistent", "downloads", "files"]],
    (downloads: { [dlId: string]: IDownload }) => {
      const count = Object.keys(downloads ?? {}).filter((id) =>
        ["init", "started", "paused"].includes(downloads[id].state),
      ).length;
      return count > 0 ? count : undefined;
    },
  );

  context.registerReducer(["persistent", "downloads"], stateReducer);
  context.registerReducer(["persistent", "transactions"], transactionsReducer);
  context.registerReducer(["settings", "downloads"], settingsReducer);

  const downloadPathForGame = (gameId: string) =>
    selectors.downloadPathForGame(context.api.getState(), gameId);

  const downloadColumns = (props: () => IDownloadViewProps) =>
    downloadAttributes(context.api, props, withAddInProgress);

  context.registerMainPage("download", "Downloads", DownloadView, {
    priority: 30,
    hotkey: "D",
    group: "global",
    badge: downloadCount,
    props: () => ({
      downloadPathForGame,
      columns: downloadColumns,
    }),
    mdi: mdiDownload,
  });

  context.registerMainPage("download", "Downloads", DownloadView, {
    priority: 210,
    id: "game-downloads",
    hotkey: "D",
    group: "per-game",
    badge: downloadCount,
    isModernOnly: true,
    visible: () =>
      selectors.activeGameId(context.api.store.getState()) !== undefined,
    props: () => ({
      downloadPathForGame,
      columns: downloadColumns,
    }),
    mdi: mdiDownload,
  });

  context.registerSettings("Download", Settings, undefined, undefined, 75);

  context.registerFooter("speed-o-meter", SpeedOMeter);

  context.registerDownloadProtocol = (
    schema: string,
    handler: ProtocolHandler,
  ) => {
    protocolHandlers[schema] = handler;
  };

  const queryCondition = (instanceIds: string[]) => {
    const state: IState = context.api.store.getState();
    const incomplete = instanceIds.find(
      (instanceId) =>
        getSafe<DownloadState>(
          state.persistent.downloads.files,
          [instanceId, "state"],
          "init",
        ) !== "finished",
    );
    return incomplete === undefined
      ? true
      : context.api.translate("Can only query finished downloads");
  };

  context.registerAction(
    "downloads-action-icons",
    100,
    "refresh",
    {},
    "Query Info",
    (instanceIds: string[]) => {
      queryInfo(context.api, instanceIds, true);
    },
    queryCondition,
  );
  context.registerAction(
    "downloads-multirow-actions",
    100,
    "refresh",
    {},
    "Query Info",
    (instanceIds: string[]) => {
      queryInfo(context.api, instanceIds, true);
    },
    queryCondition,
  );

  context.registerAttributeExtractor(100, attributeExtractor);
  context.registerAttributeExtractor(25, attributeExtractorCustom);
  context.registerActionCheck("SET_DOWNLOAD_FILEPATH", (state, action: any) => {
    if (action.payload === "") {
      return "Attempt to set invalid file name for a download";
    }
    return undefined;
  });

  context.registerActionCheck("INIT_DOWNLOAD", (state: IState, action: any) => {
    const { games } = action.payload;
    if (!truthy(games) || !Array.isArray(games) || games.length === 0) {
      return "No game associated with download";
    }
    return undefined;
  });

  context.registerActionCheck(
    "ADD_LOCAL_DOWNLOAD",
    (state: IState, action: any) => {
      const { game } = action.payload;
      if (!truthy(game) || typeof game !== "string") {
        return "No game associated with download";
      }
      return undefined;
    },
  );

  context.registerActionCheck("SET_COMPATIBLE_GAMES", (state, action: any) => {
    const { games } = action.payload;
    if (!truthy(games) || !Array.isArray(games) || games.length === 0) {
      return "Invalid set of compatible games";
    }
    return undefined;
  });

  const removeToastDebouncer = new Debouncer(
    () => {
      context.api.sendNotification({
        id: `download-removed`,
        type: "info",
        message: "Download(s) deleted",
        displayMS: 3000,
      });
      return PromiseBB.resolve();
    },
    500,
    true,
    false,
  );

  context.registerActionCheck(
    "REMOVE_DOWNLOAD",
    (state: IState, action: any) => {
      // Uncomment to help debug unexpected download removal
      // const stack = new Error().stack;
      // if (stack !== undefined) {
      //   log('debug', 'download removed', { id: action.payload, stack });
      // }
      removeToastDebouncer.schedule();
      return undefined;
    },
  );

  context.registerAction(
    "download-actions",
    100,
    ShutdownButton,
    {},
    () => ({
      t: context.api.translate,
      shutdownPending,
      activeDownloads: selectors.activeDownloads(context.api.getState()),
      toggleShutdown: () => toggleShutdown(context.api),
    }),
    () => process.platform === "win32",
  );

  context.registerTest("verify-downloads-transfers", "gamemode-activated", () =>
    checkPendingTransfer(context.api),
  );

  context.once(() => {
    Object.assign(context.api.ext, extendAPI(context.api));
    const DownloadManagerImpl: typeof DownloadManager =
      require("./DownloadManager").default;
    const observeImpl: typeof observe = require("./DownloadObserver").default;

    const store = context.api.store;

    testDownloadPath(context.api);

    // undo an earlier bug where vortex registered itself as the default http/https handler
    // (fortunately few applications actually rely on that setting, unfortunately this meant
    // the bug wasn't found for a long time)
    context.api.deregisterProtocol("http");
    context.api.deregisterProtocol("https");

    context.api.registerProtocol("http", false, (url, install) => {
      context.api.events.emit(
        "start-download",
        [url],
        {},
        undefined,
        (err: Error, dlId: string) => {
          if (install && err === null) {
            context.api.events.emit("start-install-download", dlId);
          }
        },
      );
    });

    context.api.registerProtocol("https", false, (url, install) => {
      context.api.events.emit(
        "start-download",
        [url],
        {},
        undefined,
        (err: Error, dlId: string) => {
          if (install && err === null) {
            context.api.events.emit("start-install-download", dlId);
          }
        },
      );
    });

    context.api.events.on("will-move-downloads", () => {
      if (currentWatch !== undefined) {
        currentWatch.close();
        currentWatch = undefined;
      }
    });

    context.api.events.on(
      "did-import-downloads",
      (dlIds: string[], cb?: (err?: Error) => void) => {
        queryInfo(context.api, dlIds, false)
          .then(() => cb?.())
          .catch((err) => cb?.(unknownToError(err)));
      },
    );

    context.api.onStateChange(
      ["settings", "downloads", "path"],
      (prev, cur) => {
        updateDebouncer.schedule();
      },
    );

    context.api.onStateChange(
      ["persistent", "downloads", "files"],
      (
        prev: { [dlId: string]: IDownload },
        cur: { [dlId: string]: IDownload },
      ) => {
        // when files are added without mod info, query the meta database
        const added = _.difference(Object.keys(cur), Object.keys(prev));
        const filtered = added.filter(
          (dlId) =>
            cur[dlId].state === "finished" &&
            Object.keys(cur[dlId].modInfo).length === 0,
        );

        const state: IState = context.api.store.getState();

        updateShutdown(selectors.activeDownloads(state));

        PromiseBB.map(filtered, (dlId) => {
          const rawGameId = getDownloadGames(cur[dlId])[0];
          const gameId = rawGameId
            ? convertGameIdReverse(knownGames(state), rawGameId) || rawGameId
            : rawGameId;
          const downloadPath = selectors.downloadPathForGame(state, gameId);
          if (cur[dlId].localPath === undefined) {
            // No point looking up metadata if we don't know the file's name.
            //  https://github.com/Nexus-Mods/Vortex/issues/7362
            log("warn", "failed to look up mod info", {
              id: dlId,
              reason: "Filename is unknown",
            });
            return PromiseBB.resolve();
          }
          context.api
            .lookupModMeta({
              filePath: path.join(downloadPath, cur[dlId].localPath),
              gameId: convertGameIdReverse(
                knownGames(context.api.getState()),
                cur[dlId].game[0],
              ),
            })
            .then((result) => {
              if (result.length > 0) {
                const info = result[0].value;
                store.dispatch(setDownloadModInfo(dlId, "meta", info));
              }
            })
            .catch((err) => {
              log("warn", "failed to look up mod info", err);
            });
        })
          .catch(() => null)
          .then(() => null);
        return null;
      },
    );

    context.api.events.on(
      "gamemode-activated",
      genGameModeActivated(context.api),
    );

    context.api.events.on(
      "filehash-calculated",
      (filePath: string, md5Hash: string, fileSize: number) => {
        log("debug", "file hash calculated", {
          fileName: path.basename(filePath),
          md5Hash,
          fileSize,
        });
        context.api.store.dispatch(
          setDownloadHashByFile(path.basename(filePath), md5Hash, fileSize),
        );
      },
    );

    context.api.events.on("enable-download-watch", (enabled: boolean) => {
      watchEnabled = enabled;
    });

    context.api.events.on(
      "refresh-downloads",
      (gameId: string, callback: (err) => void) => {
        updateDownloadPath(context.api, gameId)
          .then(() => {
            if (callback !== undefined) {
              callback(null);
            }
          })
          .catch((err) => {
            if (callback !== undefined) {
              callback(err);
            }
          });
      },
    );

    context.api.events.on(
      "import-downloads",
      genImportDownloadsHandler(context.api),
    );

    context.api.onAsync(
      "set-download-games",
      (dlId: string, gameIds: string[], fromMetadata?: boolean) =>
        setDownloadGames(
          context.api,
          dlId,
          gameIds.filter((x) => !!x),
          withAddInProgress,
          fromMetadata === true,
        ),
    );

    // This debouncer is only needed to avoid a race condition caused primarily by the
    //  testDownloadPath functionality, where the update downloads function gets called twice
    //  in quick succession when the user browses and selects a new downloads folder. This causes,
    //  duplicate archives to get added.
    //   It gets called:
    //  1. Due to change in settings.downloads.path.
    //  2. Due to the gamemode-activated event.
    updateDebouncer = new Debouncer(() => {
      return updateDownloadPath(context.api);
    }, 1000);

    {
      let powerTimer: NodeJS.Timeout;
      let powerBlockerId: number;
      const stopTimer = async () => {
        if (powerBlockerId !== undefined) {
          const isStarted =
            await window.api.powerSaveBlocker.isStarted(powerBlockerId);
          if (isStarted) {
            await window.api.powerSaveBlocker.stop(powerBlockerId);
          }
        }
        powerBlockerId = undefined;
        powerTimer = undefined;
      };

      const speedsDebouncer = new Debouncer(
        () => {
          store.dispatch(
            setDownloadSpeeds(
              store.getState().persistent.downloads.speedHistory,
            ),
          );
          return null;
        },
        5000,
        false,
      );

      const maxWorkersDebouncer = new Debouncer(
        (newValue: number) => {
          manager.setMaxConcurrentDownloads(newValue);
          return null;
        },
        500,
        true,
      );

      context.api.onStateChange<number>(
        ["settings", "downloads", "maxParallelDownloads"],
        (old, newValue: number) => {
          maxWorkersDebouncer.schedule(undefined, newValue);
        },
      );

      const state = context.api.getState();

      const maxParallelDownloads =
        state.persistent["nexus"]?.userInfo?.isPremium === true
          ? state.settings.downloads.maxParallelDownloads
          : 1;

      manager = new DownloadManagerImpl(
        context.api,
        selectors.downloadPath(store.getState()),
        maxParallelDownloads,
        store.getState().settings.downloads.maxChunks,
        (speed: number) => {
          if (
            speed !== 0 ||
            store.getState().persistent.downloads.speed !== 0
          ) {
            // this first call is only applied in the renderer for performance reasons
            store.dispatch(setDownloadSpeed(Math.round(speed)));
            // this schedules the main progress to be updated
            speedsDebouncer.schedule();
            if (powerTimer !== undefined) {
              clearTimeout(powerTimer);
            }
            if (powerBlockerId === undefined) {
              // Start power save blocker asynchronously
              window.api.powerSaveBlocker
                .start("prevent-app-suspension")
                .then((id) => {
                  powerBlockerId = id;
                });
            }
            powerTimer = setTimeout(stopTimer, 60000);
          }
        },
        `Nexus Client v2.${getApplication().version}`,
        protocolHandlers,
        () => context.api.getState().settings.downloads.maxBandwidth * 8,
      );
      manager.setFileExistsCB((fileName) => {
        return context.api
          .showDialog(
            "question",
            "File already exists",
            {
              text:
                'You\'ve already downloaded the file "{{fileName}}", do you want to ' +
                "download it again?",
              parameters: {
                fileName,
              },
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) => result.action === "Continue");
      });
      observer = observeImpl(context.api, manager);

      const downloads = state.persistent.downloads?.files ?? {};
      const gameMode = selectors.activeGameId(state);

      processInterruptedDownloads(context.api, downloads, gameMode);
      checkForUnfinalized(context.api, downloads, gameMode);
      removeDownloadsWithoutFile(store, downloads);

      processCommandline(context.api);

      // Expose download manager free slots to other extensions
      context.api.events.on(
        "get-download-free-slots",
        (callback: (freeSlots: number) => void) => {
          if (manager) {
            callback(manager.getFreeSlots());
          } else {
            callback(0);
          }
        },
      );
    }
  });

  return true;
}

export default init;
