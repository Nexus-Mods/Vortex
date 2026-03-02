import {
  setDownloadModInfo,
  setForcedLogout,
  setModAttribute,
} from "../../actions";
import type { IDialogResult } from "../../actions/notifications";
import { showDialog } from "../../actions/notifications";
import type {
  IExtensionApi,
  IExtensionContext,
} from "../../types/IExtensionContext";
import type { IModLookupResult } from "../../types/IModLookupResult";
import type { IState } from "../../types/IState";
import { getApplication } from "../../util/application";
import {
  DataInvalid,
  HTTPError,
  ProcessCanceled,
  ServiceTemporarilyUnavailable,
  UserCanceled,
} from "../../util/CustomErrors";
import Debouncer from "../../util/Debouncer";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import LazyComponent from "../../controls/LazyComponent";
import type { LogLevel } from "../../util/log";
import { log } from "../../util/log";
import { showError } from "../../util/message";
import opn from "../../util/opn";
import {
  activeGameId,
  downloadPathForGame,
  gameById,
  knownGames,
} from "../../util/selectors";
import { currentGame, getSafe } from "../../util/storeHelper";
import {
  batchDispatch,
  decodeHTML,
  nexusModsURL,
  Section,
  truthy,
  Content,
  Campaign,
} from "../../util/util";

import type { ICategoryDictionary } from "../category_management/types/ICategoryDictionary";
import { DownloadIsHTML } from "../download_management/DownloadManager";
import type { IGameStored } from "../gamemode_management/types/IGameStored";
import type { IMod, IModRepoId } from "../mod_management/types/IMod";

import type { IDownload } from "../download_management/types/IDownload";
import type { IResolvedURL } from "../download_management/types/ProtocolHandlers";
import { SITE_ID } from "../gamemode_management/constants";
import {
  isDownloadIdValid,
  isIdValid,
} from "../mod_management/util/modUpdateState";

import { setNewestVersion, setUserInfo } from "./actions/persistent";
import {
  addFreeUserDLItem,
  removeFreeUserDLItem,
  setOauthPending,
} from "./actions/session";
import { setAssociatedWithNXMURLs } from "./actions/settings";
import { accountReducer } from "./reducers/account";
import { persistentReducer } from "./reducers/persistent";
import { sessionReducer } from "./reducers/session";
import { settingsReducer } from "./reducers/settings";
import type { INexusAPIExtension } from "./types/INexusAPIExtension";
import { convertNXMIdReverse, nexusGameId } from "./util/convertGameId";
import {
  fillNexusIdByMD5,
  guessFromFileName,
  queryResetSource,
} from "./util/guessModID";
import retrieveCategoryList from "./util/retrieveCategories";
import Tracking from "./util/tracking";
import { makeFileUID } from "./util/UIDs";
import FreeUserDLDialog from "./views/FreeUserDLDialog";
import GoPremiumDashlet from "./views/GoPremiumDashlet";
import LoginDialog from "./views/LoginDialog";
import LoginIcon from "./views/LoginIcon";
import {} from "./views/Settings";
import FlexLayout from "../../controls/FlexLayout";
import Image from "../../controls/Image";
import { toast } from "react-hot-toast";

import {
  genCollectionIdAttribute,
  genEndorsedAttribute,
  genGameAttribute,
  genModIdAttribute,
} from "./attributes";
import {
  NEXUS_API_SUBDOMAIN,
  NEXUS_BASE_URL,
  NEXUS_DOMAIN,
  PREMIUM_PATH,
  REVALIDATION_FREQUENCY,
} from "./constants";
import * as eh from "./eventHandlers";
import NXMUrl from "./NXMUrl";
import * as sel from "./selectors";
import type { IRemoteInfo } from "./util";
import {
  bringToFront,
  endorseThing,
  ensureLoggedIn,
  getCollectionInfo,
  getInfo,
  nexusGames,
  nexusGamesProm,
  oauthCallback,
  onCancelLoginImpl,
  processErrorMessage,
  requestLogin,
  retrieveNexusGames,
  startDownload,
  updateKey,
  updateToken,
} from "./util";
import { checkModVersion } from "./util/checkModsVersion";

import type {
  IDownloadURL,
  IFileInfo,
  IFileUpdate,
  IModFile,
  IModFileQuery,
  IModInfo,
  IRevision,
  IRevisionQuery,
  IValidateKeyResponse,
} from "@nexusmods/nexus-api";
import type NexusT from "@nexusmods/nexus-api";
import { NexusError, RateLimitError, TimeoutError } from "@nexusmods/nexus-api";

import PromiseBB from "bluebird";
import * as fuzz from "fuzzball";
import type { TFunction } from "i18next";
import * as path from "path";
import * as React from "react";
import { Button } from "react-bootstrap";
import type { Action } from "redux";
import {} from "uuid";
import type { IComponentContext } from "../../types/IComponentContext";
import { MainContext } from "../../views/MainWindow";
import { getGame } from "../gamemode_management/util/getGame";
import { app } from "electron";
import Icon from "../../controls/Icon";
import {
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";

let nexus: NexusT;
let userInfoDebouncer: Debouncer;

export class APIDisabled extends Error {
  constructor(instruction: string) {
    super(`Network functionality disabled "${instruction}"`);
    this.name = this.constructor.name;
  }
}

// functions in the nexus api that don't trigger requests but instead are
// management functions to control the our api connection
const mgmtFuncs = new Set([
  "setGame",
  "getValidationResult",
  "getRateLimits",
  "setLogger",
]);
const revalidateFuncs = new Set([
  "getCollectionGraph",
  "getCollectionDownloadLink",
  "getModInfo",
  "getFileInfo",
]);

const requestFuncs = new Set([
  "revalidate",
  "setKey",
  "validateKey",
  "getTrackedMods",
  "trackMod",
  "untrackMod",
  "getGames",
  "getLatestAdded",
  "getLatestUpdated",
  "getTrending",
  "getEndorsements",
  "getColourschemes",
  "getColorschemes",
  "getGameInfo",
  "getRecentlyUpdatedMods",
  "endorseMod",
  "getModInfo",
  "getChangelogs",
  "getModFiles",
  "getFileInfo",
  "getDownloadURLs",
  "getFileByMD5",
  "modsByUid",
  "modFilesByUid",
  "fileHashes",
  "getCollectionDownloadLink",
  "createCollection",
  "updateCollection",
  "createOrUpdateRevision",
  "editCollection",
  "publishRevision",
  "attachCollectionsToCategory",
  "getCollectionGraph",
  "getCollectionListGraph",
  "getCollectionRevisionGraph",
  "getRevisionUploadUrl",
  "endorseCollection",
  "rateRevision",
  "getCollectionVideo",
  "getOwnIssues",
  "sendFeedback",
]);

class Disableable {
  private mDisabled = false;
  private mLastValidation: number = Date.now();
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  public get(obj: NexusT, prop) {
    const state: IState = this.mApi.store.getState();
    const { networkConnected } = state.session.base;
    if (prop === "disable") {
      return () => (this.mDisabled = true);
    } else if (!requestFuncs.has(prop)) {
      return obj[prop];
    } else if (!networkConnected) {
      const cErr = new Error();
      return () => {
        const e = new ProcessCanceled(`network disconnected: ${prop}`);
        e.stack = cErr.stack;
        return PromiseBB.reject(e);
      };
    } else if (this.mDisabled) {
      return () => PromiseBB.reject(new APIDisabled(prop));
    } else if (prop === "getFileByMD5") {
      return (hash: string, gameId?: string) => {
        if (gameId?.toLowerCase() === "skyrimse") {
          this.mApi.showErrorNotification(
            "Attempt to send invalid API request, please report this (once)",
            new Error(`getFileByMD5 called with game id ${gameId}`),
            { id: "api-invalid-gameid" },
          );
          gameId = "skyrimspecialedition";
        }
        return obj[prop](hash, gameId);
      };
    } else if (revalidateFuncs.has(prop)) {
      // tslint:disable-next-line:no-this-assignment
      const that = this;
      // tslint:disable-next-line:only-arrow-functions
      return function (...args) {
        const now = Date.now();
        const state = that.mApi.getState();
        // we don't do this if logged in via OAuth because we primarily care about the
        // premium status and that is also included in the JWT token which gets refreshed
        // automatically
        const key = state.confidential.account?.["nexus"]?.["APIKey"];
        if (
          key !== undefined &&
          now > that.mLastValidation + REVALIDATION_FREQUENCY
        ) {
          that.mLastValidation = now;
          // the purpose of this is to renew our user info, in case the user
          // has bought premium since the last validation but technically
          // it's possible we never logged in successfully in the first place
          // because the internet was offline at startup.
          // In that case we can use this opportunity to try to log in now
          const prom: PromiseBB<IValidateKeyResponse> =
            key === undefined
              ? PromiseBB.resolve(undefined as IValidateKeyResponse)
              : PromiseBB.resolve(
                  truthy(obj.getValidationResult())
                    ? obj.revalidate()
                    : obj.setKey(key),
                );

          return prom.then((userInfo) => {
            if (truthy(userInfo)) {
              that.mApi.events.emit("did-login", null);
            }
            return obj[prop](...args);
          });
        } else {
          return obj[prop](...args);
        }
      };
    } else {
      return obj[prop];
    }
  }
}

function getCaller() {
  // save original values
  const origLimit = Error.stackTraceLimit;
  const origHandler = Error.prepareStackTrace;

  // set up error to return the vanilla v8 stack trace
  const dummyObject: { stack?: any } = {};
  Error.stackTraceLimit = Infinity;
  Error.prepareStackTrace = (dummy, trace) => trace;
  Error.captureStackTrace(dummyObject, getCaller);
  const v8StackTrace = dummyObject.stack;

  // restore original values
  Error.prepareStackTrace = origHandler;
  Error.stackTraceLimit = origLimit;

  return v8StackTrace;
}

function framePos(frame: any) {
  return `${frame.getFileName()}:${frame.getLineNumber()}:${frame.getColumnNumber()}`;
}

const requestLog = {
  requests: [],
  logPath: path.join(getVortexPath("userData"), "network.log"),
  debouncer: new Debouncer(() => {
    // TODO: why does "this" not point to the right object here?
    const reqs = requestLog.requests;
    requestLog.requests = [];
    return fs
      .writeFileAsync(requestLog.logPath, reqs.join("\n") + "\n", { flag: "a" })
      .then(() => null);
  }, 500),
  log(prop: string, args: any[], caller: string) {
    this.requests.push(
      `success - (${Date.now()}) ${prop} (${args.join(", ")}) from ${caller}`,
    );
    this.debouncer.schedule();
  },
  logErr(prop: string, args: any[], caller: string, err: Error) {
    this.requests.push(
      `failed - (${Date.now()}) ${prop} (${args.join(", ")}) from ${caller}: ${err.message}`,
    );
    this.debouncer.schedule();
  },
  get(obj, prop) {
    if (mgmtFuncs.has(prop) || typeof obj[prop] !== "function") {
      return obj[prop];
    } else {
      return (...args) => {
        const prom = obj[prop](...args);
        if (prom.then !== undefined) {
          const stack = getCaller();
          let caller = stack[1].getFunctionName();
          if (caller === null) {
            caller = framePos(stack[1]);
          }
          return prom
            .then((res) => {
              if (prop === "setKey") {
                // don't log sensitive data
                this.log(prop, [], caller);
              } else {
                this.log(prop, args || [], caller);
              }
              return PromiseBB.resolve(res);
            })
            .catch((err) => {
              if (typeof err === "string") {
                err = new Error(err);
              }
              if (prop === "setKey") {
                // don't log sensitive data
                this.logErr(prop, [], caller, err);
              } else {
                this.logErr(prop, args || [], caller, err);
              }
              err.stack +=
                "\n\nCalled from:\n\n" +
                stack
                  .map(
                    (frame) =>
                      `  at ${frame.getFunctionName()} (${framePos(frame)})`,
                  )
                  .join("\n");
              return PromiseBB.reject(err);
            });
        } else {
          return prom;
        }
      };
    }
  },
};

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (
    schema: string,
    handler: (
      inputUrl: string,
      name: string,
    ) => PromiseBB<{ urls: string[]; meta: any }>,
  ) => void;
}

function retrieveCategories(api: IExtensionApi, isUpdate: boolean) {
  let askUser: PromiseBB<boolean>;
  if (isUpdate) {
    askUser = api.store
      .dispatch(
        showDialog(
          "question",
          "Retrieve Categories",
          {
            text: "Clicking RETRIEVE you will lose all your changes",
          },
          [{ label: "Cancel" }, { label: "Retrieve" }],
        ),
      )
      .then((result: IDialogResult) => {
        return result.action === "Retrieve";
      });
  } else {
    askUser = PromiseBB.resolve(true);
  }

  askUser.then((userContinue: boolean) => {
    if (!userContinue) {
      return;
    }

    // the server error message we get if we're not logged gives no indication that that's the problem
    // so we have to check before
    if (!sel.isLoggedIn(api.getState())) {
      showError(
        api.store.dispatch,
        "An error occurred retrieving categories",
        "You are not logged in to Nexus Mods!",
        { allowReport: false },
      );
    } else {
      let gameId;
      return currentGame(api.store)
        .then((game: IGameStored) => {
          gameId = game.id;
          const nexusId = nexusGameId(game);
          if (
            nexusGames().find((ngame) => ngame.domain_name === nexusId) ===
            undefined
          ) {
            // for all we know there could be another extension providing categories for this game
            // so we can't really display an error message or anything
            log("debug", "game unknown on nexus", { gameId: nexusId });
            return PromiseBB.reject(new ProcessCanceled("unsupported game"));
          }
          log("info", "retrieve categories for game", gameId);
          return retrieveCategoryList(nexusId, nexus);
        })
        .then((categories: ICategoryDictionary) => {
          api.events.emit("update-categories", gameId, categories, isUpdate);
        })
        .catch(ProcessCanceled, () => null)
        .catch(TimeoutError, () => {
          api.sendNotification({
            type: "warning",
            message:
              "Timeout retrieving categories from server, please try again later.",
          });
        })
        .catch((err) => {
          if (["ESOCKETTIMEDOUT", "ETIMEDOUT"].includes(err.code)) {
            api.sendNotification({
              type: "warning",
              message:
                "Timeout retrieving categories from server, please try again later.",
            });
          } else if (err.syscall === "getaddrinfo") {
            api.sendNotification({
              type: "warning",
              message:
                "Failed to retrieve categories from server because network address " +
                '"{{host}}" could not be resolved. This is often a temporary error, ' +
                "please try again later.",
              replace: { host: err.host || err.hostname },
            });
          } else if (["ENOTFOUND", "ENOENT"].includes(err.code)) {
            api.sendNotification({
              type: "warning",
              message:
                "Failed to resolve address of server. This is probably a temporary problem " +
                "with your own internet connection.",
            });
          } else if (["ENETUNREACH"].includes(err.code)) {
            api.sendNotification({
              type: "warning",
              message:
                "Server can't be reached, please check your internet connection.",
            });
          } else if (err.message.includes("OPENSSL_internal")) {
            api.sendNotification({
              type: "warning",
              message: "Network connection failed, please try again later.",
            });
          } else if (
            ["ECONNRESET", "ECONNREFUSED", "ECONNABORTED"].includes(err.code)
          ) {
            api.sendNotification({
              type: "warning",
              message:
                "The server refused the connection, please try again later.",
            });
          } else {
            const detail = processErrorMessage(err);
            let allowReport = detail.Servermessage === undefined;
            if (detail.noReport) {
              allowReport = false;
              delete detail.noReport;
            }
            showError(
              api.store.dispatch,
              "Failed to retrieve categories",
              detail,
              { allowReport },
            );
          }
        });
    }
  });
}

function openNexusPage(state: IState, gameIds: string[]) {
  const game = gameById(state, gameIds[0]);
  opn(`${NEXUS_BASE_URL}/${nexusGameId(game)}`).catch((err) => undefined);
}

function remapCategory(
  state: IState,
  category: number,
  fromGame: string,
  toGame: string,
) {
  if (fromGame === toGame || fromGame === undefined) {
    // should be the default case: we're installing the mod for the game it's intended for
    return category;
  }

  const fromCategory = getSafe(
    state,
    ["persistent", "categories", fromGame, category, "name"],
    undefined,
  );
  const toGameCategories: Array<{ name: string }> = getSafe(
    state,
    ["persistent", "categories", toGame],
    undefined,
  );

  if (fromCategory === undefined || toGameCategories === undefined) {
    return category;
  }

  const sorted = Object.keys(toGameCategories).sort(
    (lhs, rhs) =>
      fuzz.ratio(toGameCategories[rhs].name, fromCategory) -
      fuzz.ratio(toGameCategories[lhs].name, fromCategory),
  );

  return sorted[0];
}

function toTimestamp(time?: string): number {
  if (time === undefined) {
    return 0;
  }
  return new Date(time).getTime();
}

function safeParseInt(input: any, radix: number = 10): number {
  const res = parseInt(input, radix);
  if (isNaN(res)) {
    return undefined;
  }
  return res;
}

// Cache for processAttributes to avoid repeated API calls
const attributesCache: { [key: string]: { data: any; expires: number } } = {};
const ATTRIBUTES_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function processAttributes(
  state: IState,
  input: any,
  quick: boolean,
): PromiseBB<any> {
  const nexusChangelog = input.nexus?.fileInfo?.changelog_html;

  const modName = decodeHTML(
    input.download?.modInfo?.nexus?.modInfo?.name ??
      input.download?.modInfo?.name,
  );
  const fileName = decodeHTML(
    input.download?.modInfo?.nexus?.fileInfo?.name ??
      input.download?.localPath ??
      input.meta?.fileName,
  );
  const fuzzRatio =
    modName !== undefined && fileName !== undefined
      ? fuzz.ratio(modName, fileName)
      : 100;

  let fetchPromise: PromiseBB<IRemoteInfo> = PromiseBB.resolve(undefined);

  let gameId =
    input.download?.modInfo?.game ||
    input.download?.modInfo?.nexus?.ids?.gameId;

  if (
    input.download?.modInfo?.nexus?.modInfo == null &&
    input.download?.modInfo?.source === "nexus"
  ) {
    const modId =
      input.download?.modInfo?.ids?.modId ??
      input.download?.modInfo?.nexus?.ids?.modId;
    const fileId =
      input.download?.modInfo?.ids?.fileId ??
      input.download?.modInfo?.nexus?.ids?.fileId;
    const collectionSlug =
      input.download?.modInfo?.ids?.collectionSlug ??
      input.download?.modInfo?.nexus?.ids?.collectionSlug;
    const revisionId =
      input.download?.modInfo?.ids?.revisionId ??
      input.download?.modInfo?.nexus?.ids?.revisionId;
    const revisionNumber =
      input.download?.modInfo?.ids?.revisionNumber ??
      input.download?.modInfo?.nexus?.ids?.revisionNumber;

    if (!quick) {
      let cacheKey: string = "";
      if (truthy(gameId) && truthy(modId) && truthy(fileId)) {
        // not entirely sure how this is possible
        if (Array.isArray(gameId)) {
          gameId = gameId[0];
        }
        cacheKey = `mod_${gameId}_${modId}_${fileId}`;
        // Check cache first
        const cached = attributesCache[cacheKey];
        if (cached && Date.now() < cached.expires) {
          fetchPromise = PromiseBB.resolve(cached.data);
        } else {
          const domain = nexusGameId(gameById(state, gameId), gameId);

          // Make API call non-blocking by not awaiting it immediately
          fetchPromise = getInfo(
            nexus,
            domain,
            parseInt(modId, 10),
            parseInt(fileId, 10),
          )
            .then((result) => {
              // Cache the successful result
              if (result) {
                attributesCache[cacheKey] = {
                  data: result,
                  expires: Date.now() + ATTRIBUTES_CACHE_DURATION,
                };
              }
              return result;
            })
            .catch((err) => {
              log("error", "failed to fetch nexus info during mod install", {
                gameId,
                modId,
                fileId,
                error: err.message,
              });
              return undefined;
            });
        }
      } else if (truthy(revisionNumber) || truthy(revisionId)) {
        cacheKey = `collection_${collectionSlug}_${revisionNumber || revisionId}`;

        // Check cache first
        const cached = attributesCache[cacheKey];
        if (cached && Date.now() < cached.expires) {
          fetchPromise = PromiseBB.resolve(cached.data);
        } else {
          fetchPromise = getCollectionInfo(
            nexus,
            collectionSlug,
            revisionNumber,
            revisionId,
          )
            .then((result) => {
              // Cache the successful result
              if (result) {
                attributesCache[cacheKey] = {
                  data: result,
                  expires: Date.now() + ATTRIBUTES_CACHE_DURATION,
                };
              }
              return result;
            })
            .catch((err) => {
              const errorLevel = [
                "COLLECTION_UNDER_MODERATION",
                "NOT_FOUND",
              ].includes(err.code)
                ? "warn"
                : "error";
              log(errorLevel, "failed to fetch nexus info about collection", {
                gameId,
                collectionSlug,
                revisionNumber,
                error: err.message,
              });
              return undefined;
            });
        }
      }
    }
  }

  return fetchPromise.then((info: IRemoteInfo) => {
    const nexusModInfo: IModInfo =
      info?.modInfo ?? input.download?.modInfo?.nexus?.modInfo;
    const nexusFileInfo: IFileInfo =
      info?.fileInfo ?? input.download?.modInfo?.nexus?.fileInfo;
    const nexusIds = input.download?.modInfo?.nexus?.ids;
    const nexusCollectionInfo: IRevision =
      info?.revisionInfo ?? input.download?.modInfo?.nexus?.revisionInfo;

    const gameMode = activeGameId(state);
    const category = remapCategory(
      state,
      nexusModInfo?.category_id,
      gameId,
      gameMode,
    );

    return {
      modId:
        input.download?.modInfo?.nexus?.ids?.modId ??
        safeParseInt(input.meta?.details?.modId),
      fileId:
        input.download?.modInfo?.nexus?.ids?.fileId ??
        safeParseInt(input.meta?.details?.fileId),
      collectionId:
        input.download?.modInfo?.nexus?.ids?.collectionId ??
        nexusCollectionInfo?.collection?.id,
      revisionId:
        input.download?.modInfo?.nexus?.ids?.revisionId ??
        nexusCollectionInfo?.id,
      collectionSlug:
        nexusIds?.collectionSlug ?? nexusCollectionInfo?.collection["slug"],
      revisionNumber:
        nexusIds?.revisionNumber ?? nexusCollectionInfo?.revisionNumber,
      author:
        nexusModInfo?.author ?? nexusCollectionInfo?.collection?.user?.name,
      uploader:
        nexusModInfo?.uploaded_by ??
        nexusCollectionInfo?.collection?.user?.name,
      uploaderUrl: nexusModInfo?.uploaded_users_profile_url,
      uploaderAvatar:
        nexusModInfo?.user?.avatar ??
        nexusCollectionInfo?.collection?.user?.avatar,
      uploaderId:
        nexusModInfo?.user?.member_id ??
        nexusCollectionInfo?.collection?.user?.memberId,
      category,
      pictureUrl:
        nexusModInfo?.picture_url ??
        nexusCollectionInfo?.collection?.tileImage?.url,
      description:
        nexusModInfo?.description ??
        nexusCollectionInfo?.collection?.description,
      shortDescription:
        nexusModInfo?.summary ?? nexusCollectionInfo?.collection?.summary,
      fileType: nexusFileInfo?.category_name,
      isPrimary: nexusFileInfo?.is_primary,
      modName,
      logicalFileName: input.meta?.logicalFileName ?? fileName,
      changelog: truthy(nexusChangelog)
        ? { format: "html", content: nexusChangelog }
        : undefined,
      uploadedTimestamp:
        nexusFileInfo?.uploaded_timestamp ??
        toTimestamp(nexusCollectionInfo?.createdAt),
      updatedTimestamp: toTimestamp(nexusCollectionInfo?.updatedAt),
      version:
        nexusFileInfo?.version ??
        nexusCollectionInfo?.revisionNumber?.toString?.(),
      modVersion:
        nexusModInfo?.version ??
        nexusCollectionInfo?.revisionNumber?.toString?.(),
      allowRating: input?.download?.modInfo?.nexus?.modInfo?.allow_rating,
      customFileName: fuzzRatio < 50 ? `${modName} - ${fileName}` : undefined,
      rating: nexusCollectionInfo?.rating,
    };
  });
}

function doDownload(api: IExtensionApi, url: string): PromiseBB<string> {
  return (
    startDownload(api, nexus, url)
      .catch(DownloadIsHTML, () => undefined)
      // DataInvalid is used here to indicate invalid user input or invalid
      // data from remote, so it's presumably not a bug in Vortex
      .catch(DataInvalid, () => {
        api.showErrorNotification("Failed to start download", url, {
          allowReport: false,
        });
        return PromiseBB.resolve(undefined);
      })
      .catch(UserCanceled, () => PromiseBB.resolve(undefined))
      .catch((err) => {
        api.showErrorNotification("Failed to start download", err);
        return PromiseBB.resolve(undefined);
      })
  );
}

// Main process initialization moved to src/main/extensions/nexusIntegration.ts

interface IAwaitedLink {
  gameId: string;
  modId: number;
  fileId: number;
  resolve: (url: string) => void;
}

const awaitedLinks: IAwaitedLink[] = [];

function makeNXMLinkCallback(api: IExtensionApi) {
  return (url: string, install: boolean) => {
    let nxmUrl: NXMUrl;
    try {
      nxmUrl = new NXMUrl(url);

      const state = api.getState();
      const isExtAvailable =
        state.session.extensions.available.find(
          (iter) => iter.modId === nxmUrl.modId,
        ) !== undefined;

      if (nxmUrl.type === "oauth") {
        try {
          return oauthCallback(api, nxmUrl.oauthCode, nxmUrl.oauthState);
        } catch (err) {
          // ignore unexpected code
        }
      } else if (nxmUrl.type === "premium") {
        try {
          log("info", "makeNXMLinkCallback() premium");
          userInfoDebouncer.schedule();
          return false;
        } catch (err) {
          // ignore unexpected code
        }
      } else if (nxmUrl.gameId === SITE_ID && isExtAvailable) {
        if (install) {
          return api.emitAndAwait("install-extension", {
            name: "Pending",
            modId: nxmUrl.modId,
            fileId: nxmUrl.fileId,
          });
        } else {
          api.events.emit("show-extension-page", nxmUrl.modId);
          bringToFront();
          return PromiseBB.resolve();
        }
      } else {
        const { foregroundDL } = state.settings.interface;
        if (foregroundDL) {
          bringToFront();
        }
      }
    } catch (err) {
      api.showErrorNotification("Invalid URL", err, { allowReport: false });
      return;
    }

    const awaitedIdx = awaitedLinks.findIndex(
      (link) =>
        link.gameId === nxmUrl.gameId &&
        link.modId === nxmUrl.modId &&
        link.fileId === nxmUrl.fileId,
    );
    if (awaitedIdx !== -1) {
      const awaited = awaitedLinks.splice(awaitedIdx, 1);
      awaited[0].resolve(url);
      return;
    }

    ensureLoggedIn(api)
      .then(() => doDownload(api, url))
      .then((dlId) => {
        if (dlId === undefined || dlId === null) {
          return PromiseBB.resolve(undefined);
        }

        const actions: Action[] = [setDownloadModInfo(dlId, "source", "nexus")];
        if (nxmUrl.collectionId !== undefined) {
          actions.push(
            setDownloadModInfo(dlId, "collectionId", nxmUrl.collectionId),
          );
        }
        if (nxmUrl.revisionId !== undefined) {
          actions.push(
            setDownloadModInfo(dlId, "revisionId", nxmUrl.revisionId),
          );
        }
        if (nxmUrl.collectionSlug !== undefined) {
          actions.push(
            setDownloadModInfo(dlId, "collectionSlug", nxmUrl.collectionSlug),
          );
        }
        if (nxmUrl.revisionNumber !== undefined && nxmUrl.revisionNumber > 0) {
          actions.push(
            setDownloadModInfo(dlId, "revisionNumber", nxmUrl.revisionNumber),
          );
        }
        batchDispatch(api.store, actions);

        return new PromiseBB((resolve, reject) => {
          const currentState: IState = api.store.getState();
          const download = currentState.persistent.downloads.files[dlId];
          if (download === undefined) {
            return reject(new ProcessCanceled(`Download not found "${dlId}"`));
          }
          // collections always get installed automatically.
          if (install && nxmUrl.type !== "collection") {
            api.events.emit(
              "start-install-download",
              dlId,
              (err: Error, id: string) => {
                if (err !== null) {
                  reject(err);
                } else {
                  resolve();
                }
              },
            );
          } else {
            resolve();
          }
        });
      })
      // doDownload handles all download errors so the catches below are
      //  only for log in errors
      .catch(UserCanceled, () => null)
      .catch(ProcessCanceled, (err) => {
        api.showErrorNotification("Log-in failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      })
      .catch(ServiceTemporarilyUnavailable, (err) => {
        api.showErrorNotification("Service temporarily unavailable", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      })
      .catch((err) => {
        api.showErrorNotification("Failed to get access key", err, {
          id: "failed-get-nexus-key",
        });
      });
  };
}

function makeRepositoryLookup(api: IExtensionApi, nexusConn: NexusT) {
  const query: Partial<IModFileQuery> = {
    name: true,
    categoryId: true,
    description: true,
    size: true,
    version: true,
    game: {
      id: true,
      domainName: true,
    },
    uid: true,
    uri: true,
    mod: {
      author: true,
      modCategory: {
        id: true,
      },
    },
  } as any;

  interface IQueueItem {
    repoInfo: IModRepoId;
    resolve: (info: any) => void;
    reject: (err: Error) => void;
  }

  let pendingQueries: IQueueItem[] = [];
  const uidLookupDebouncer = new Debouncer(
    () => {
      const processingQueries = pendingQueries;
      pendingQueries = [];
      return nexusGamesProm().then(() => {
        return nexusConn
          .modFilesByUid(
            query,
            processingQueries.map((iter) =>
              makeFileUID(iter.repoInfo),
            ) as any[],
          )
          .then((files: IModFile[]) => {
            processingQueries.forEach((item) => {
              const uid = makeFileUID(item.repoInfo);
              const res = files.find((iter) => iter["uid"] === uid);
              if (res !== undefined) {
                item.resolve(res);
              } else {
                // the number of uids we can request in one call may be limited, just retry.
                // We're supposed to get an error if the request actually failed.
                pendingQueries.push(item);
              }
            });
          })
          .catch((unknownError) => {
            const err = unknownToError(unknownError);
            processingQueries.forEach((item) => {
              item.reject(err);
            });
          })
          .finally(() => {
            if (pendingQueries.length > 0) {
              uidLookupDebouncer.schedule();
            }
          });
      });
    },
    100,
    true,
  );

  const queue = (repoInfo: IModRepoId): PromiseBB<Partial<IModFile>> => {
    return new PromiseBB((resolve, reject) => {
      pendingQueries.push({ repoInfo, resolve, reject });
      uidLookupDebouncer.schedule();
    });
  };

  return (repoInfo: IModRepoId): PromiseBB<IModLookupResult[]> => {
    const modId = parseInt(repoInfo.modId, 10);
    const fileId = parseInt(repoInfo.fileId, 10);

    return queue(repoInfo).then((modFileInfo) => {
      const res: IModLookupResult = {
        key: `${repoInfo.gameId}_${repoInfo.modId}_${repoInfo.fileId}`,
        value: {
          fileName: modFileInfo.name,
          fileSizeBytes: modFileInfo.size,
          fileVersion: modFileInfo.version,
          gameId: modFileInfo.game.id.toString(),
          domainName: modFileInfo.game.domainName,
          sourceURI: `nxm://${repoInfo.gameId}/mods/${modId}/files/${fileId}`,
          source: "nexus",
          logicalFileName: modFileInfo.name,
          archived: modFileInfo.categoryId === 7,
          rules: [],
          details: {
            modId: repoInfo.modId,
            fileId: repoInfo.fileId,
            author: modFileInfo.mod.author,
            category: modFileInfo.mod.modCategory.id.toString().split(",")[0],
            description: modFileInfo.description,
            homepage: `${NEXUS_BASE_URL}/${repoInfo.gameId}/mods/${modId}`,
          },
        },
      };
      return [res];
    });

    /*
    let modInfo: IModInfo;
    let fileInfo: IFileInfo;
    return Promise.resolve(nexusConn.getModInfo(modId, repoInfo.gameId))
      .then(modInfoIn => {
        modInfo = modInfoIn;
        return nexusConn.getFileInfo(modId, fileId, repoInfo.gameId);
      })
      .then(fileInfoIn => {
        fileInfo = fileInfoIn;
        const res: IModLookupResult = {
          key: `${repoInfo.gameId}_${repoInfo.modId}_${repoInfo.fileId}`,
          value: {
            fileName: fileInfo.file_name,
            fileSizeBytes: fileInfo.size,
            fileVersion: fileInfo.version,
            gameId: modInfo.game_id.toString(),
            domainName: modInfo.domain_name,
            sourceURI: `nxm://${repoInfo.gameId}/mods/${modId}/files/${fileId}`,
            source: 'nexus',
            logicalFileName: fileInfo.name,
            rules: [],
            details: {
              modId: repoInfo.modId,
              fileId: repoInfo.fileId,
              author: modInfo.author,
              category: modInfo.category_id.toString(),
              description: fileInfo.description,
              homepage: `https://www.${NEXUS_DOMAIN}/${repoInfo.gameId}/mods/${modId}`,
            },
          },
        };
        return [res];
      });
    */
  };
}

function checkModsWithMissingMeta(api: IExtensionApi) {
  const state = api.getState();
  const { mods } = state.persistent;
  const downloads = state.persistent.downloads.files ?? {};

  const actions: Action[] = [];

  const allMods = Object.entries(mods).flatMap(([gameId, gameMods]) =>
    Object.entries(gameMods).map(([modId, mod]) => ({ gameId, modId, mod })),
  );

  for (const { gameId, modId, mod } of allMods) {
    if (mod.archiveId === undefined || downloads[mod.archiveId] === undefined) {
      continue;
    }

    const before = actions.length;
    const attributes = mod?.attributes ?? {};
    const download = downloads[mod.archiveId];
    let source = attributes.source;

    if (source === undefined && download.modInfo?.source === "nexus") {
      actions.push(setModAttribute(gameId, modId, "source", "nexus"));
      source = "nexus";
    }

    if (source === "nexus" && mod.archiveId !== undefined) {
      const ids = download.modInfo?.nexus?.ids ?? {};
      if (!truthy(attributes.modId) && truthy(ids?.modId)) {
        actions.push(setModAttribute(gameId, modId, "modId", ids.modId));
      }
      if (!truthy(attributes.fileId) && truthy(ids?.fileId)) {
        actions.push(setModAttribute(gameId, modId, "fileId", ids.fileId));
      }
      if (!truthy(attributes.downloadGame) && truthy(ids?.gameId)) {
        actions.push(
          setModAttribute(gameId, modId, "downloadGame", ids.gameId),
        );
      }
    }

    // Only log if we made changes (reduce JSON.stringify overhead)
    if (actions.length !== before && process.env.NODE_ENV === "development") {
      log("info", "mod meta updating", {
        modId,
        mod: JSON.stringify(mod),
        meta: JSON.stringify(download.modInfo),
      });
    }
  }

  log("info", "fixing mod meta info", { count: actions.length });
  batchDispatch(api.store, actions);
}

function extendAPI(api: IExtensionApi, nexus: NexusT): INexusAPIExtension {
  return {
    nexusCheckModsVersion: eh.onCheckModsVersion(api, nexus),
    nexusDownload: eh.onNexusDownload(api, nexus),
    nexusGetCollection: eh.onGetNexusCollection(api, nexus),
    nexusGetCollections: eh.onGetNexusCollections(api, nexus),
    nexusSearchCollections: eh.onSearchCollections(api, nexus),
    nexusGetMyCollections: eh.onGetMyCollections(api, nexus),
    nexusResolveCollectionUrl: eh.onResolveCollectionUrl(api, nexus),
    nexusGetCollectionRevision: eh.onGetNexusCollectionRevision(api, nexus),
    nexusRateCollectionRevision: eh.onRateRevision(api, nexus),
    nexusEndorseDirect: eh.onEndorseDirect(api, nexus),
    nexusGetLatestMods: eh.onGetLatestMods(api, nexus),
    nexusGetTrendingMods: eh.onGetTrendingMods(api, nexus),
    nexusEndorseMod: eh.onEndorseMod(api, nexus),
    nexusSubmitFeedback: eh.onSubmitFeedback(nexus),
    nexusSubmitCollection: eh.onSubmitCollection(nexus),
    nexusModUpdate: eh.onModUpdate(api, nexus),
    nexusOpenCollectionPage: eh.onOpenCollectionPage(api),
    nexusOpenModPage: eh.onOpenModPage(api),
    nexusRequestNexusLogin: (callback) => requestLogin(nexus, api, callback),
    nexusRequestOwnIssues: eh.onRequestOwnIssues(nexus),
    nexusRetrieveCategoryList: (isUpdate: boolean) =>
      retrieveCategories(api, isUpdate),
    nexusGetModFiles: eh.onGetModFiles(api, nexus),
    nexusDownloadUpdate: eh.onDownloadUpdate(api, nexus),
    nexusModFileContents: eh.onModFileContents(api, nexus),
    nexusGetModRequirements: eh.onGetModRequirements(api, nexus),
    nexusGetPreferences: eh.onGetPreferences(api, nexus),
    nexusGetUserKeyData: eh.onGetUserKeyData(api),
  };
}

function once(api: IExtensionApi, callbacks: Array<(nexus: NexusT) => void>) {
  const registerFunc = (def?: boolean) => {
    if (def === undefined) {
      api.store.dispatch(setAssociatedWithNXMURLs(true));
    }

    // main entry point for nxm protocol links to be handled
    if (api.registerProtocol("nxm", def !== false, makeNXMLinkCallback(api))) {
      api.sendNotification({
        type: "info",
        message: "Vortex will now handle Nexus Download links",
        actions: [
          {
            title: "More",
            action: () => {
              api.showDialog(
                "info",
                "Download link handling",
                {
                  text:
                    'Only one application can be set up to handle Nexus "Mod Manager Download" ' +
                    "links, Vortex is now registered to do that.\n\n" +
                    "To use a different application for these links, please go to " +
                    'Settings->Downloads, disable the "Handle Nexus Links" option, then go to ' +
                    "the application you do want to handle the links and enable the corresponding " +
                    "option there.",
                },
                [{ label: "Close" }],
              );
            },
          },
        ],
      });
    }
  };

  {
    // limit lifetime of state
    const state = api.getState();

    const Nexus: typeof NexusT = require("@nexusmods/nexus-api").default;
    const apiKey = state.confidential.account?.["nexus"]?.["APIKey"];
    const oauthCred =
      state.confidential.account?.["nexus"]?.["OAuthCredentials"]; // get credentials from state - this only happens once when extension is loading
    const loggedIn = apiKey !== undefined || oauthCred !== undefined;

    log("info", "nexus_integration auth state status", {
      apiKey: apiKey !== undefined,
      oauthCred: oauthCred !== undefined,
      loggedIn: loggedIn,
    });

    const gameMode = activeGameId(state);

    nexus = new Proxy(
      new Proxy(
        new Nexus(
          "Vortex",
          getApplication().version,
          nexusGameId(getGame(gameMode)),
          30000,
        ),
        new Disableable(api),
      ),
      requestLog,
    );

    nexus.setLogger((level: LogLevel, message: string, meta: any) =>
      log(level, message, meta),
    );

    /**
     * this has probably been set from an application level migration, and so we should show the dialog
     * about what happened and why
     */

    const forcedLogout =
      state.confidential.account?.["nexus"]?.["ForcedLogout"] ?? false;

    log("info", "nexus_integration forcedLogout", {
      forcedLogout: forcedLogout,
    });

    if (forcedLogout) {
      // show dialog to explain whats going on
      api.showDialog(
        "info",
        "You have been logged out",
        {
          text:
            "Due to an update with how Vortex communicates with Nexus Mods you will need to log back into your account.\n\n" +
            "This change will allow Vortex to better keep your account details in sync without requiring you to log out and back in again or restart the app.",
        },
        [
          {
            label: "Dismiss",
            action: () => {
              log("info", "dismiss dialog");
            },
          },
          {
            label: "Login",
            action: () => {
              log("info", "log in about now?!");
              ensureLoggedIn(api);
            },
            default: true,
          },
        ],
      );

      // set flag so we don't do this everytime
      api.store.dispatch(setForcedLogout(false));
    } else {
      // check to see if we have oauth credentials in state, if so, then we need to update nexus-node
      if (oauthCred !== undefined) {
        log(
          "info",
          "OAuth credentials found in state. updating nexus-node credentials",
        );
        updateToken(api, nexus, oauthCred);
      } else {
        //updateKey(api, nexus, apiKey);
      }
    }

    registerFunc(
      getSafe(state, ["settings", "nexus", "associateNXM"], undefined),
    );

    api.registerRepositoryLookup(
      "nexus",
      true,
      makeRepositoryLookup(api, nexus),
    );

    retrieveNexusGames(nexus).catch((err) => {
      api.showErrorNotification("Failed to fetch list of games", err, {
        allowReport: false,
      });
    });
  }

  api.onAsync("check-mods-version", eh.onCheckModsVersion(api, nexus));
  api.onAsync("nexus-download", eh.onNexusDownload(api, nexus));
  api.onAsync("get-nexus-collection", eh.onGetNexusCollection(api, nexus));
  api.onAsync("get-nexus-collections", eh.onGetNexusCollections(api, nexus));
  api.onAsync("get-my-collections", eh.onGetMyCollections(api, nexus));
  api.onAsync("resolve-collection-url", eh.onResolveCollectionUrl(api, nexus));
  api.onAsync(
    "get-nexus-collection-revision",
    eh.onGetNexusCollectionRevision(api, nexus),
  );
  api.onAsync("rate-nexus-collection-revision", eh.onRateRevision(api, nexus));
  api.onAsync("endorse-nexus-mod", eh.onEndorseDirect(api, nexus));
  api.onAsync("get-latest-mods", eh.onGetLatestMods(api, nexus));
  api.onAsync("get-trending-mods", eh.onGetTrendingMods(api, nexus));
  api.onAsync("send-metric", eh.sendMetric(api, nexus));
  api.events.on("refresh-user-info", eh.onRefreshUserInfo(nexus, api));
  api.events.on("endorse-mod", eh.onEndorseMod(api, nexus));
  api.events.on("submit-feedback", eh.onSubmitFeedback(nexus));
  api.events.on("submit-collection", eh.onSubmitCollection(nexus));
  api.events.on("mods-update", eh.onModsUpdate(api, nexus));
  api.events.on("mod-update", eh.onModUpdate(api, nexus));
  api.events.on("open-collection-page", eh.onOpenCollectionPage(api));
  api.events.on("open-mod-page", eh.onOpenModPage(api));
  api.events.on("request-nexus-login", (callback) =>
    requestLogin(nexus, api, callback),
  );
  api.events.on("request-own-issues", eh.onRequestOwnIssues(nexus));
  api.events.on("retrieve-category-list", (isUpdate: boolean) => {
    retrieveCategories(api, isUpdate);
  });
  api.events.on("gamemode-activated", (gameId: string) => {
    nexus.setGame(nexusGameId(getGame(gameId)));
  });

  api.onAsync("start-download-update", eh.onDownloadUpdate(api, nexus));
  api.onAsync("get-mod-files", eh.onGetModFiles(api, nexus));

  api.onStateChange(
    ["settings", "nexus", "associateNXM"],
    eh.onChangeNXMAssociation(registerFunc, api),
  );
  api.onStateChange(
    ["confidential", "account", "nexus", "APIKey"],
    eh.onAPIKeyChanged(api, nexus),
  );
  api.onStateChange(
    ["confidential", "account", "nexus", "OAuthCredentials"],
    eh.onOAuthTokenChanged(api, nexus),
  );

  api.onStateChange(["persistent", "mods"], eh.onChangeMods(api, nexus));
  api.onStateChange(
    ["persistent", "downloads", "files"],
    eh.onChangeDownloads(api, nexus),
  );

  api.addMetaServer("nexus_api", {
    nexus,
    url: `https://${NEXUS_API_SUBDOMAIN}.${NEXUS_DOMAIN}`,
    cacheDurationSec: 86400,
  });

  Object.assign(api.ext, extendAPI(api, nexus));

  nexus
    .getModInfo(1, SITE_ID)
    .then((info) => {
      api.store.dispatch(setNewestVersion(info.version));
    })
    .catch((err) => {
      // typically just missing the api key or a downtime
      log("info", "failed to determine newest Vortex version", {
        error: getErrorMessageOrDefault(err),
      });
    });

  checkModsWithMissingMeta(api);

  callbacks.forEach((cb) => cb(nexus));
}

function toolbarBanner(t: TFunction): React.FunctionComponent<any> {
  return () => {
    const context = React.useContext<IComponentContext>(MainContext);
    const premiumPictogramPath = "assets/pictograms/premium-pictogram.svg";

    const trackAndGoToPremium = (e) => {
      context.api.events.emit(
        "analytics-track-click-event",
        "Go Premium",
        "Header",
      );
      goBuyPremium(e);
    };

    return (
      <div id="nexus-header-ad">
        <button onClick={trackAndGoToPremium} data-campaign={Content.HeaderAd}>
          <FlexLayout type="row" className="ad-flex-container">
            <FlexLayout.Flex>
              <FlexLayout type="column" className="text-flex-container">
                <div className="nexus-header-ad-title">
                  Want <span className="ad-title-highlight">more time</span>{" "}
                  playing?
                </div>
                <div className="nexus-header-ad-body">
                  Save time with{" "}
                  <span className="ad-body-highlight">max download speeds</span>
                  ,{" "}
                  <span className="ad-body-highlight">
                    auto-install collections
                  </span>
                  , and <span className="ad-body-highlight">no ads</span>.
                </div>
              </FlexLayout>
            </FlexLayout.Flex>

            <FlexLayout.Fixed>
              <Image
                className="premium-pictogram"
                srcs={[premiumPictogramPath]}
              />
            </FlexLayout.Fixed>
          </FlexLayout>

          <FlexLayout type="row" className="custom-hover-overlay">
            <FlexLayout.Fixed>
              <FlexLayout type="row" className="hover-overlay-content">
                {t("Go Premium")}
                <div className="arrow-forward" />
              </FlexLayout>
            </FlexLayout.Fixed>
          </FlexLayout>
        </button>
      </div>
    );
  };
}

function goBuyPremium(evt: React.MouseEvent<any>) {
  const content = evt.currentTarget.getAttribute("data-campaign");
  opn(
    nexusModsURL(PREMIUM_PATH, {
      section: Section.Users,
      campaign: Campaign.BuyPremium,
      content: content,
    }),
  ).catch((err) => undefined);
}

function idValid(
  thingId: string,
  mods: { [modId: string]: IMod },
  downloads: { [dlId: string]: IDownload },
) {
  return mods[thingId] !== undefined
    ? isIdValid(mods[thingId])
    : isDownloadIdValid(downloads[thingId]);
}

function includesMissingMetaId(
  api: IExtensionApi,
  instanceIds: string[],
): boolean {
  const state: IState = api.getState();
  const gameMode = activeGameId(state);
  const mods = state.persistent.mods[gameMode];
  const downloads = state.persistent.downloads.files;

  return (
    instanceIds.find((instanceId) => !idValid(instanceId, mods, downloads)) !==
    undefined
  );
}

function fixIds(api: IExtensionApi, instanceIds: string[]) {
  const { store } = api;
  const state: IState = store.getState();
  const gameMode = activeGameId(state);
  const mods = state.persistent.mods[gameMode];
  const downloads = state.persistent.downloads.files;
  return PromiseBB.all(
    instanceIds.map((id) => {
      if (idValid(id, mods, downloads)) {
        return PromiseBB.resolve();
      }

      let fileName: string;

      let isDownload = false;
      const mod = mods[id];
      if (mod !== undefined) {
        fileName = getSafe(
          mod.attributes,
          ["fileName"],
          getSafe(mod.attributes, ["name"], undefined),
        );
      } else if (getSafe(downloads, [id], undefined) !== undefined) {
        isDownload = true;
        const download = downloads[id];
        fileName = download.localPath;
      }

      if (fileName !== undefined) {
        const guessed = guessFromFileName(fileName);
        if (guessed !== undefined) {
          if (isDownload) {
            store.dispatch(setDownloadModInfo(id, "nexus.ids.modId", guessed));
          } else {
            store.dispatch(setModAttribute(gameMode, id, "source", "nexus"));
            store.dispatch(setModAttribute(gameMode, id, "modId", guessed));
          }
        }
      }

      if (mod !== undefined) {
        const downloadPath = downloadPathForGame(state, gameMode);
        const hasArchive =
          mod.archiveId !== undefined && downloads[mod.archiveId] !== undefined;

        if (mod.attributes?.fileMD5 !== undefined) {
          return fillNexusIdByMD5(
            api,
            gameMode,
            mod,
            fileName,
            downloadPath,
            hasArchive,
          ).catch((err) => {
            api.showErrorNotification("Query failed", err, {
              allowReport: false,
            });
          });
        } else {
          return checkModVersion(api.store, nexus, gameMode, mod).catch(
            (err) => {
              if (err.statusCode === 403) {
                return queryResetSource(api, gameMode, mod);
              } else {
                api.showErrorNotification("Query failed", err, {
                  allowReport: false,
                });
              }
            },
          );
        }
      }
      return PromiseBB.resolve();
    }),
  ).then(() => null);
}

type AwaitLinkCB = (
  gameId: string,
  modId: number,
  fileId: number,
) => PromiseBB<string>;

interface IDLQueueItem {
  input: string;
  url: NXMUrl;
  name: string;
  friendlyName: string;
  canceled: boolean;
  res: (res: IResolvedURL) => void;
  rej: (err: Error) => void;
  queryRelevantUpdates: () => PromiseBB<IFileUpdate[]>;
}

const freeDLQueue: IDLQueueItem[] = [];

const DL_QUERY: IRevisionQuery = {
  id: true,
  downloadLink: true,
  collection: {
    id: true,
  },
};

function makeNXMProtocol(api: IExtensionApi, onAwaitLink: AwaitLinkCB) {
  // for free users a dialog needs to be displayed sending them to the site for the download.
  // if we start multiple downloads in parallel, these are shown one by one but if the user cancels
  // the dialog, we want to cancel all queued downloads, otherwise the client code can't cancel
  // out of the larger process without the user having to click cancel multiple times.
  // Thus we have to keep track of all queued downloads.

  function freeUserDownload(
    input: string,
    url: NXMUrl,
    name: string,
    friendlyName: string,
  ) {
    // non-premium user trying to download a file with no id, have to send the user to the
    // corresponding site to generate a proper link
    return new PromiseBB<IResolvedURL>((resolve, reject, onCancel) => {
      const res = (result: IResolvedURL) => {
        if (resolve !== undefined) {
          // just to make sure we remove the correct item, idx should always be 0
          const idx = freeDLQueue.findIndex((iter) => iter.input === input);
          api.store.dispatch(removeFreeUserDLItem(input));
          freeDLQueue.splice(idx, 1);
          resolve(result);
          reject = undefined;
          resolve = undefined;
        }
      };
      const rej = (err) => {
        if (reject !== undefined) {
          const idx = freeDLQueue.findIndex((iter) => iter.input === input);
          api.store.dispatch(removeFreeUserDLItem(input));
          freeDLQueue.splice(idx, 1);
          reject(err);
          reject = undefined;
          resolve = undefined;
        }
      };
      const queryRelevantUpdates = () => {
        return nexus.getModFiles(url.modId, url.gameId).then((files) => {
          // Build a bidirectional map for O(1) lookups, we're doing this
          //  in the hope that the mod authors have kept a clear update chain
          //  which we can use to find relevant fileIds.
          // It's not cool that we're consuming an API slot for this, but without this
          //  we can't reliably compare the dependency reference to what we're attempting
          //  to skip (we only have the NXM url which isn't enough).
          const forwardMap = new Map<number, IFileUpdate>(); // old_file_id -> update
          const backwardMap = new Map<number, IFileUpdate>(); // new_file_id -> update

          files.file_updates.forEach((update) => {
            forwardMap.set(update.old_file_id, update);
            backwardMap.set(update.new_file_id, update);
          });

          // Traverse backwards to find the oldest file in the chain
          let currentId = url.fileId;
          const backwardChain: IFileUpdate[] = [];

          while (backwardMap.has(currentId)) {
            const update = backwardMap.get(currentId);
            backwardChain.unshift(update); // Add to beginning
            currentId = update.old_file_id;
          }

          // Now traverse forwards from the oldest file to build complete chain
          const oldestId =
            backwardChain.length > 0
              ? backwardChain[0].old_file_id
              : url.fileId;
          currentId = oldestId;
          const completeChain: IFileUpdate[] = [];

          while (forwardMap.has(currentId)) {
            const update = forwardMap.get(currentId);
            completeChain.push(update);
            currentId = update.new_file_id;
          }

          return completeChain;
        });
      };
      const queueItems = {
        input,
        url,
        name,
        friendlyName,
        res,
        rej,
        queryRelevantUpdates,
        canceled: false,
      };
      onCancel(() => {
        queueItems.canceled = true;
        const idx = freeDLQueue.findIndex((iter) => iter.input === input);
        freeDLQueue.splice(idx, 1);
      });
      freeDLQueue.push(queueItems as any);
      api.store.dispatch(addFreeUserDLItem(input));
    });
  }

  // Cache download URLs to avoid repeated API calls for the same file
  const downloadURLCache: {
    [key: string]: { urls: string[]; expires: number; meta: any };
  } = {};
  const DOWNLOAD_URL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  function premiumUserDownload(
    input: string,
    url: NXMUrl,
  ): PromiseBB<IResolvedURL> {
    const state = api.getState();
    const games = knownGames(state);
    const gameId = convertNXMIdReverse(games, url.gameId);
    const pageId = nexusGameId(gameById(state, gameId), url.gameId);
    let revisionInfo: Partial<IRevision>;

    const revNumber = url.revisionNumber >= 0 ? url.revisionNumber : undefined;

    if (!["mod", "collection"].includes(url.type)) {
      return PromiseBB.reject(new ProcessCanceled("Not a download url"));
    }

    // Create cache key
    const cacheKey =
      url.type === "mod"
        ? `mod_${url.modId}_${url.fileId}_${pageId}`
        : `collection_${url.collectionSlug}_${revNumber || "latest"}`;

    // Check cache first
    const cached = downloadURLCache[cacheKey];
    if (cached && Date.now() < cached.expires) {
      return PromiseBB.resolve({
        urls: cached.urls,
        updatedUrl: input,
        meta: cached.meta,
      });
    }

    return PromiseBB.resolve()
      .then(() =>
        url.type === "mod"
          ? nexus
              .getDownloadURLs(
                url.modId,
                url.fileId,
                url.key,
                url.expires,
                pageId,
              )
              .then((res: IDownloadURL[]) => {
                const result = {
                  urls: res.map((u) => u.URI),
                  updatedUrl: input,
                  meta: {
                    source: "nexus",
                    nexus: {
                      ids: {
                        modId: url.modId,
                        fileId: url.fileId,
                      },
                    },
                  } as any,
                };

                // Cache the result
                downloadURLCache[cacheKey] = {
                  urls: result.urls,
                  expires: Date.now() + DOWNLOAD_URL_CACHE_DURATION,
                  meta: result.meta,
                };

                return result;
              })
          : nexus
              .getCollectionRevisionGraph(
                DL_QUERY,
                url.collectionSlug,
                revNumber,
              )
              .catch((err) => {
                err["collectionSlug"] = url.collectionSlug;
                err["revisionNumber"] = url.revisionNumber;
                return PromiseBB.reject(err);
              })
              .then((revision: Partial<IRevision>) => {
                revisionInfo = revision;
                return nexus.getCollectionDownloadLink(revision.downloadLink);
              })
              .then((downloadUrls) => {
                const result = {
                  urls: downloadUrls.map((iter) => iter.URI),
                  updatedUrl: input,
                  meta: {
                    source: "nexus",
                    nexus: {
                      ids: {
                        collectionId: revisionInfo.collection.id,
                        revisionId: revisionInfo.id,
                        collectionSlug: url.collectionSlug,
                        revisionNumber: url.revisionNumber,
                      },
                    },
                  } as any,
                };

                // Cache the result
                downloadURLCache[cacheKey] = {
                  urls: result.urls,
                  expires: Date.now() + DOWNLOAD_URL_CACHE_DURATION,
                  meta: result.meta,
                };

                return result;
              }),
      )
      .catch(NexusError, (err) => {
        const newError = new HTTPError(
          err.statusCode,
          err.message,
          err.request,
        );
        newError.stack = err.stack;
        return PromiseBB.reject(newError);
      })
      .catch(RateLimitError, (err) => {
        api.showErrorNotification("Rate limit exceeded", err, {
          allowReport: false,
        });
        return PromiseBB.reject(err);
      });
  }

  const resolveFunc = (
    input: string,
    name?: string,
    friendlyName?: string,
  ): PromiseBB<IResolvedURL> => {
    const state = api.store.getState();

    let url: NXMUrl;
    try {
      url = new NXMUrl(input);
    } catch (err) {
      return PromiseBB.reject(err);
    }

    const userInfo: any = getSafe(
      state,
      ["persistent", "nexus", "userInfo"],
      undefined,
    );
    if (url.userId !== undefined && url.userId !== userInfo?.userId) {
      const userName: string = getSafe(
        state,
        ["persistent", "nexus", "userInfo", "name"],
        undefined,
      );
      api.showErrorNotification(
        "Invalid download links",
        "The link was not created for this account ({{userName}}). " +
          "You have to be logged into nexusmods.com with the same account that you use in Vortex.",
        { allowReport: false, replace: { userName } },
      );
      return PromiseBB.reject(new ProcessCanceled("Wrong user id"));
    }

    if (
      (!userInfo?.isPremium || process.env["FORCE_FREE_DOWNLOADS"] === "yes") &&
      url.type === "mod" &&
      url.gameId !== SITE_ID &&
      url.key === undefined
    ) {
      log("info", "free user stuff", {
        input: input,
        url: JSON.stringify(url),
        name: name,
        friendlyName: friendlyName,
      });
      return freeUserDownload(input, url, name, friendlyName);
    } else {
      log("info", "premium user stuff", {
        input: input,
        url: JSON.stringify(url),
      });
      return premiumUserDownload(input, url);
    }
  };

  return resolveFunc;
}

function onUpdated() {
  bringToFront();
}

type ResolveFunc = (
  input: string,
  name?: string,
  friendlyName?: string,
) => PromiseBB<IResolvedURL>;

function onDownloadImpl(resolveFunc: ResolveFunc, inputUrl: string) {
  const queueItem = freeDLQueue.find((iter) => iter.input === inputUrl);
  if (queueItem === undefined) {
    log("error", "failed to find queue item", {
      inputUrl,
      queue: JSON.stringify(freeDLQueue),
    });
    return;
  }
  const { url } = queueItem;

  awaitedLinks.push({
    gameId: url.gameId,
    modId: url.modId,
    fileId: url.fileId,
    resolve: (resUrl: string) =>
      resolveFunc(resUrl, queueItem.name, queueItem.friendlyName)
        .then(queueItem.res)
        .catch(queueItem.rej),
  });

  opn(
    `${NEXUS_BASE_URL}/${url.gameId}/mods/${url.modId}?tab=files&file_id=${url.fileId}&nmm=1`,
  ).catch(() => null);
}

function onSkip(api: IExtensionApi, inputUrl: string) {
  const queueItem = freeDLQueue.find((iter) => iter.input === inputUrl);
  if (queueItem !== undefined) {
    queueItem
      .queryRelevantUpdates()
      .then((updates) => {
        const fileIdSet = new Set<string>();
        const fileNames = new Set<string>();
        fileIdSet.add(queueItem.url.fileId.toString());
        fileNames.add(queueItem.name);
        fileNames.add(queueItem.friendlyName);
        updates.forEach((update) => {
          if (update.old_file_id != null) {
            fileIdSet.add(update.old_file_id.toString());
            fileNames.add(update.old_file_name);
          }
          if (update.new_file_id != null) {
            fileIdSet.add(update.new_file_id.toString());
            fileNames.add(update.new_file_name);
          }
        });
        const parsed = new NXMUrl(queueItem.input);
        const itemIdentifiers = {
          ...parsed.identifiers,
          fileNames: Array.from(fileNames),
          fileIds: Array.from(fileIdSet),
        };
        api.events.emit("free-user-skipped-download", itemIdentifiers);
        queueItem.rej(new UserCanceled(true));
      })
      .catch((err) => {
        log("warn", "failed to query relevant updates on skip", {
          error: err.message,
        });
        queueItem.rej(new UserCanceled(true));
      });
  }
}

function onRetryImpl(
  resolveFunc: ResolveFunc,
  api: IExtensionApi,
  inputUrl: string,
) {
  const queueItem = freeDLQueue.find((iter) => iter.input === inputUrl);
  if (queueItem === undefined) {
    log("error", "failed to find queue item", {
      inputUrl,
      queue: JSON.stringify(freeDLQueue),
    });
    return;
  }

  resolveFunc(queueItem.input).then(queueItem.res).catch(queueItem.rej);

  /*
const awaitedLink = {
gameId: url.gameId,
modId: url.modId,
fileId: url.fileId,
resolve: (resUrl: string) =>
resolveFunc(resUrl, queueItem.name, queueItem.friendlyName)
  .then(queueItem.res)
  .catch(queueItem.rej),
};
*/

  //awaitedLinks.push(awaitedLink);
}

function onCheckStatusImpl() {
  userInfoDebouncer.schedule();
}

function onCancelImpl(api: IExtensionApi, inputUrl: string): boolean {
  const copy = freeDLQueue.slice(0);
  if (copy.length !== 0) {
    copy.forEach((item) => {
      item.rej(new UserCanceled(false));
    });
    return true;
  } else {
    api.store.dispatch(removeFreeUserDLItem(inputUrl));
    return false;
  }
}

function init(context: IExtensionContextExt): boolean {
  context.registerReducer(["confidential", "account", "nexus"], accountReducer);
  context.registerReducer(["settings", "nexus"], settingsReducer);
  context.registerReducer(["persistent", "nexus"], persistentReducer);
  context.registerReducer(["session", "nexus"], sessionReducer);
  context.registerAction(
    "application-icons",
    200,
    LoginIcon,
    { isClassicOnly: true },
    () => ({
      nexus,
    }),
  );
  context.registerAction(
    "mods-action-icons",
    800,
    "open-ext",
    {},
    "Open Source Website",
    (ids) => {
      const state: IState = context.api.getState();
      const gameMode = activeGameId(state);
      if (gameMode === undefined) {
        return;
      }

      const gameMods = state.persistent.mods[gameMode];
      if (!gameMods) return;

      for (const id of ids) {
        const mod = gameMods[id];
        if (!mod || !mod.attributes?.url) {
          return;
        }

        opn(mod.attributes.url).catch((err) => null);
      }
    },
    (ids) => {
      const state: IState = context.api.getState();
      const gameMode = activeGameId(state);
      if (gameMode === undefined) {
        return false;
      }

      const gameMods = state.persistent.mods[gameMode];
      if (!gameMods) return false;

      return ids.every((id) => {
        const mod = gameMods[id];
        return mod && mod.attributes?.source === "website";
      });
    },
  );
  context.registerAction(
    "mods-action-icons",
    999,
    "nexus",
    {},
    "Open on Nexus Mods",
    (instanceIds) => {
      const state: IState = context.api.store.getState();
      const gameMode = activeGameId(state);
      const mod: IMod = getSafe(
        state.persistent.mods,
        [gameMode, instanceIds[0]],
        undefined,
      );
      if (mod !== undefined) {
        const gameId =
          mod.attributes?.downloadGame !== undefined
            ? mod.attributes?.downloadGame
            : gameMode;
        if (mod.type === "collection") {
          context.api.events.emit(
            "open-collection-page",
            gameId,
            mod.attributes?.collectionSlug,
            mod.attributes?.revisionNumber,
            mod.attributes?.source,
          );
        } else {
          context.api.events.emit(
            "open-mod-page",
            gameId,
            mod.attributes?.modId,
            mod.attributes?.source,
          );
        }
      } else {
        const ids = getSafe(
          state.persistent.downloads,
          ["files", instanceIds[0], "modInfo", "nexus", "ids"],
          undefined,
        );
        if (ids !== undefined) {
          if (ids.collectionSlug !== undefined) {
            context.api.events.emit(
              "open-collection-page",
              ids.gameId || gameMode,
              ids.collectionSlug,
              ids.revisionNumber,
              "nexus",
            );
          } else {
            context.api.events.emit(
              "open-mod-page",
              ids.gameId || gameMode,
              ids.modId,
              "nexus",
            );
          }
        }
      }
    },
    (instanceIds) => {
      const state: IState = context.api.store.getState();
      const gameMode = activeGameId(state);

      let modSource = getSafe(
        state.persistent.mods,
        [gameMode, instanceIds[0], "attributes", "source"],
        undefined,
      );
      if (modSource === undefined) {
        modSource = getSafe(
          state.persistent.downloads,
          ["files", instanceIds[0], "modInfo", "source"],
          undefined,
        );
      }

      return modSource === "nexus";
    },
  );

  const tracking = new Tracking(context.api);

  /*
  context.registerAction('global-icons', 100, 'feedback', {}, 'Clear OAuth State', () => {
    log('info', 'Clear OAuth State');
    context.api.store.dispatch(clearOAuthCredentials(null));
  });*/

  userInfoDebouncer = new Debouncer(
    () => {
      if (!sel.isLoggedIn(context.api.getState())) {
        log("warn", "Not logged in");
        return PromiseBB.resolve();
      }

      context.api.events.emit("refresh-user-info");

      return PromiseBB.resolve();
    },
    3000,
    true,
    false,
  );

  context.registerAction(
    "global-icons",
    100,
    "nexus",
    { isClassicOnly: true },
    "Refresh User Info",
    () => {
      log("info", "Refresh User Info global menu item clicked");
      userInfoDebouncer.schedule();
    },
  );

  /*
  // DNU: was used for testing... no longer public
  context.registerAction('global-icons', 100, 'nexus', {}, 'Force Token Refresh', () => {
    log('info', 'Force Token Refresh');
    nexus.handleJwtRefresh();
  });*/

  context.registerAction(
    "mods-action-icons",
    300,
    "smart",
    {},
    "Fix missing IDs",
    (instanceIds) => {
      fixIds(context.api, instanceIds);
    },
    (instanceIds) => includesMissingMetaId(context.api, instanceIds),
  );
  context.registerAction(
    "mods-multirow-actions",
    300,
    "smart",
    {},
    "Fix missing IDs",
    (instanceIds) => {
      fixIds(context.api, instanceIds);
    },
    (instanceIds) => includesMissingMetaId(context.api, instanceIds),
  );
  context.registerAction(
    "mods-multirow-actions",
    250,
    "track",
    {},
    "Track",
    (instanceIds) => {
      tracking.trackMods(instanceIds);
    },
  );
  context.registerAction(
    "mods-multirow-actions",
    250,
    "track",
    { hollowIcon: true },
    "Untrack",
    (instanceIds) => {
      tracking.untrackMods(instanceIds);
    },
  );

  const resolveFunc = makeNXMProtocol(
    context.api,
    (gameId: string, modId: number, fileId: number) =>
      new PromiseBB((resolve) => {
        console.log("makeNXMProtocol", {
          gameId: gameId,
          modId: modId,
          fileId: fileId,
        });
        awaitedLinks.push({ gameId, modId, fileId, resolve });
      }),
  );

  // this makes it so the download manager can use nxm urls as download urls
  context.registerDownloadProtocol("nxm", resolveFunc);

  context.registerSettings(
    "Download",
    LazyComponent(() => require("./views/Settings")),
  );

  const onCancelLogin = () => onCancelLoginImpl(context.api);

  context.registerDialog("login-dialog", LoginDialog, () => ({
    onCancelLogin,
    onReceiveCode: (code: string, state: string) =>
      oauthCallback(context.api, code, state),
  }));

  const onDownload = (inputUrl: string) =>
    onDownloadImpl(resolveFunc, inputUrl);

  const onCancel = (inputUrl: string) => onCancelImpl(context.api, inputUrl);

  const onCheckStatus = () => onCheckStatusImpl();

  const onRetry = (inputUrl: string) =>
    onRetryImpl(resolveFunc, context.api, inputUrl);

  context.registerDialog("free-user-download", FreeUserDLDialog, () => ({
    t: context.api.translate,
    nexus,
    onUpdated,
    onDownload,
    onSkip: (inputUrl: string) => onSkip(context.api, inputUrl),
    onCancel,
    onRetry,
    onCheckStatus,
  }));

  context.registerBanner(
    "downloads",
    () => {
      const t = context.api.translate;
      const electricBoltIconPath = "assets/icons/electric-bolt.svg";
      const trackAndGoToPremium = (e) => {
        context.api.events.emit(
          "analytics-track-click-event",
          "Go Premium",
          "Downloads",
        );
        goBuyPremium(e);
      };
      return (
        <div id="nexus-download-banner">
          <div className="banner-text">
            Free users are{" "}
            <span className="text-highlight">capped at 3MB/s</span> (1.5 MB/s
            with AdBlock). Play your modded games{" "}
            <span className="text-highlight">faster with premium</span>.
          </div>
          <Button
            id="get-premium-button"
            data-campaign={Content.DownloadsBannerAd}
            onClick={trackAndGoToPremium}
          >
            <Image srcs={[electricBoltIconPath]} />
            {t("Unlock max download speeds")}
          </Button>
        </div>
      );
    },
    {
      props: {
        isPremium: (state) =>
          getSafe(
            state,
            ["persistent", "nexus", "userInfo", "isPremium"],
            false,
          ),
      },
      condition: (props: any): boolean => !props.isPremium,
    },
  );

  context.registerBanner("main-toolbar", toolbarBanner(context.api.translate), {
    props: {
      isPremium: (state) =>
        getSafe(state, ["persistent", "nexus", "userInfo", "isPremium"], false),
      isSupporter: (state) =>
        getSafe(
          state,
          ["persistent", "nexus", "userInfo", "isSupporter"],
          false,
        ),
    },
    condition: (props: any): boolean => !props.isPremium && !props.isSupporter,
  });

  context.registerModSource(
    "nexus",
    "Nexus Mods",
    () => {
      currentGame(context.api.store).then((game) => {
        opn(`${NEXUS_BASE_URL}/${nexusGameId(game)}`).catch((err) => undefined);
      });
    },
    {
      icon: "nexus",
      supportsModId: true,
    },
  );

  context.registerAction(
    "categories-icons",
    100,
    "download",
    {},
    "Retrieve categories",
    () => retrieveCategories(context.api, true),
  );

  context.registerTableAttribute(
    "mods",
    genEndorsedAttribute(
      context.api,
      (gameId: string, modId: string, endorseStatus: string) =>
        endorseThing(context.api, nexus, gameId, modId, endorseStatus),
    ),
  );

  context.registerTableAttribute("mods", tracking.attribute());
  context.registerTableAttribute("mods", genGameAttribute(context.api));
  context.registerTableAttribute(
    "mods",
    genModIdAttribute(context.api, () => nexus),
  );
  context.registerTableAttribute(
    "mods",
    genCollectionIdAttribute(context.api, () => nexus),
  );

  /* tentatively removed, deemed unnecessary
  context.registerDashlet('Nexus Mods Account Banner', 3, 1, 0, DashboardBanner,
                          undefined, undefined, {
    fixed: true,
    closable: true,
  });
  */

  context.registerDashlet(
    "Go Premium",
    1,
    2,
    200,
    GoPremiumDashlet,
    (state: IState) =>
      getSafe(
        state,
        ["persistent", "nexus", "userInfo", "isPremium"],
        undefined,
      ) !== true &&
      getSafe(
        state,
        ["persistent", "nexus", "userInfo", "isSupporter"],
        undefined,
      ) !== true,
    undefined,
    {
      fixed: false,
      closable: false,
    },
  );

  context.registerAttributeExtractor(50, (input: any, modPath: string) => {
    return processAttributes(
      context.api.store.getState(),
      input,
      modPath === undefined,
    );
  });

  context.registerAction(
    "game-discovered-buttons",
    120,
    "nexus",
    {},
    context.api.translate("Open Nexus Page"),
    (games: string[]) => openNexusPage(context.api.store.getState(), games),
  );

  context.registerAction(
    "game-managed-buttons",
    120,
    "nexus",
    {},
    context.api.translate("Open Nexus Page"),
    (games: string[]) => openNexusPage(context.api.store.getState(), games),
  );

  context.registerAction(
    "game-undiscovered-buttons",
    120,
    "nexus",
    {},
    context.api.translate("Open Nexus Page"),
    (games: string[]) => openNexusPage(context.api.store.getState(), games),
    (games: string[]) =>
      gameById(context.api.getState(), games[0]) !== undefined,
  );

  context.registerAPI("getNexusGames", () => nexusGamesProm(), {});
  context.registerAPI("ensureLoggedIn", () => ensureLoggedIn(context.api), {});

  const extIntegrations: Array<(nex: NexusT) => void> = [
    (nex: NexusT) => tracking.once(nex),
  ];
  context["registerNexusIntegration"] = (cb: (nex: NexusT) => void) => {
    extIntegrations.push(cb);
  };

  context.once(() => once(context.api, extIntegrations));

  return true;
}

export default init;
