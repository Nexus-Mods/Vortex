import type {
  EndorsedStatus,
  ICollectionQuery,
  IEndorsement,
  IFileInfo,
  IGameListEntry,
  IOAuthCredentials,
  IModFile,
  IRevision,
  IRevisionQuery,
  IUpdateEntry,
  ICollectionSearchOptions,
  ICollectionSearchResult,
  IPreference,
  ModStatus,
  IGraphUser,
  IModInfo,
  IModFileQuery,
} from "@nexusmods/nexus-api";
import type Nexus from "@nexusmods/nexus-api";
import { NexusError, RateLimitError, TimeoutError } from "@nexusmods/nexus-api";
import { makeFileUID } from "./util/UIDs";
import BluebirdPromise from "bluebird";
import type { TFunction } from "i18next";
import jwt from "jsonwebtoken";
import * as _ from "lodash";
import * as path from "path";
import type * as Redux from "redux";
import * as util from "util";
import {
  addNotification,
  dismissNotification,
  setDialogVisible,
  setExtensionEndorsed,
  setModAttribute,
  setOAuthCredentials,
} from "../../actions";
import type { IExtensionApi, ThunkStore } from "../../types/IExtensionContext";
import type { IMod, IState } from "../../types/IState";
import {
  DataInvalid,
  HTTPError,
  ProcessCanceled,
  TemporaryError,
  UserCanceled,
} from "../../util/CustomErrors";
import { contextify, setApiKey, setOauthToken } from "../../util/errorHandling";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { getPreloadApi, getWindowId } from "../../util/preloadAccess";
import { RateLimitExceeded } from "../../util/github";
import { log } from "../../logging";
import { calcDuration, showError } from "../../util/message";
import { jsonRequest } from "../../util/network";
import opn from "../../util/opn";
import { activeGameId } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch, toPromise, truthy } from "../../util/util";
import type { RedownloadMode } from "../download_management/DownloadManager";
import {
  AlreadyDownloaded,
  DownloadIsHTML,
} from "../download_management/DownloadManager";
import { SITE_ID } from "../gamemode_management/constants";
import { gameById, knownGames } from "../gamemode_management/selectors";
import modName from "../mod_management/util/modName";
import { setUserInfo } from "./actions/persistent";
import { setLoginId, setOauthPending } from "./actions/session";
import {
  OAUTH_CLIENT_ID,
  OAUTH_REDIRECT_URL,
  OAUTH_URL,
  getOAuthRedirectUrl,
} from "./constants";
import NXMUrl from "./NXMUrl";
import { isLoggedIn } from "./selectors";
import type { IJWTAccessToken } from "./types/IJWTAccessToken";
import {
  checkModVersion,
  fetchRecentUpdates,
  ONE_DAY,
  ONE_MINUTE,
} from "./util/checkModsVersion";
import {
  convertGameIdReverse,
  convertNXMIdReverse,
  nexusGameId,
} from "./util/convertGameId";
import { endorseCollection, endorseMod } from "./util/endorseMod";
import { FULL_REVISION_INFO, MOD_FILE_INFO } from "./util/graphQueries";
import type { ITokenReply } from "./util/oauth";
import OAuth from "./util/oauth";
import type { IValidateKeyDataV2 } from "./types/IValidateKeyData";
import { IAccountStatus } from "./types/IValidateKeyData";
import {
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";

const UPDATE_CHECK_DELAY = 60 * 60 * 1000;

const GAMES_JSON_URL = "https://data.nexusmods.com/file/nexus-data/games.json";

interface INexusLoginMessage {
  id: string;
  appid: string;
  protocol: number;
  token?: string;
}

interface IUserInfo {
  sub: string;
  name: string;
  email: string;
  avatar: string;
  group_id: number;
  membership_roles: string[];
  premium_expiry: number;
}

let cancelLogin: () => void;

/**
 * Search for collections using the GraphQL API
 *
 * @param {Nexus} nexus - The Nexus API instance
 * @param {ICollectionQuery} query - GraphQL query for collection fields
 * @param {types.ICollectionSearchOptions} options - Search options (gameId, filters, sort, etc.)
 * @return {Promise<types.ICollectionSearchResult>} Search results with nodes and totalCount
 */
export function searchCollections(
  nexus: Nexus,
  query: ICollectionQuery,
  options: ICollectionSearchOptions,
): Promise<ICollectionSearchResult> {
  return Promise.resolve(nexus.searchCollectionsGraph(query, options));
}

export function onCancelLoginImpl(api: IExtensionApi) {
  if (cancelLogin !== undefined) {
    try {
      cancelLogin();
    } catch (err) {
      // the only time we ever see this happen is a case where the websocket connection
      // wasn't established yet so the cancelation failed because it wasn't necessary.
      log("info", "login not canceled", getErrorMessageOrDefault(err));
    }
  }
  api.store.dispatch(setLoginId(undefined));
  api.events.emit("did-login", new UserCanceled());
}

export async function bringToFront() {
  // if window is snapped in windows (aero snap), bringing the window to front
  // will unsnap it and it will be moved/resized to where it was before snapping.
  // This is quite irritating so this will store the (snapped) window position
  // and return to it after bringing the window to front.
  // This will cause a short "flicker" if the window was snapped and it will
  // still unsnap the window as far as windows is concerned.

  const windowId = getWindowId();
  const api = getPreloadApi();
  const [x, y] = await api.window.getPosition(windowId);
  const [w, h] = await api.window.getSize(windowId);

  await api.window.setAlwaysOnTop(windowId, true);
  await api.window.show(windowId);
  await api.window.setAlwaysOnTop(windowId, false);

  setTimeout(() => {
    void api.window.setPosition(windowId, x, y);
    void api.window.setSize(windowId, w, h);
  }, 100);
}

function genId() {
  try {
    const uuid = require("uuid");
    return uuid.v4();
  } catch (err) {
    // odd, still unidentified bugs where bundled modules fail to load.
    log("warn", "failed to import uuid module", getErrorMessageOrDefault(err));
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.apply(null, Array(10))
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join("");
    // the probability that this fails for another user at exactly the same time
    // and they both get the same random number is practically 0
  }
}

/*
function legacyConnect(api: IExtensionApi, callback: (err: Error) => void) {
  const loginMessage: INexusLoginMessage = {
    id: genId(),
    appid: 'Vortex',
    protocol: 2,
  };

  let keyReceived: boolean = false;
  let connectionAlive: boolean = true;
  let error: Error;
  let attempts = 5;


  const connection = new WebSocket(`wss://sso.${NEXUS_DOMAIN}`)
    .on('open', () => {
      cancelLogin = () => {
        connection.close();
      };
      connection.send(JSON.stringify(loginMessage), err => {
        api.store.dispatch(setLoginId(loginMessage.id));
        if (err) {
          api.showErrorNotification('Failed to start login', err);
          connection.close();
        }
      });
      // open the authorization page - but not on reconnects!
      if (loginMessage.token === undefined) {
        opn(getPageURL(loginMessage.id)).catch(err => undefined);
      }
      const keepAlive = setInterval(() => {
        if (!connectionAlive) {
          connection.terminate();
          clearInterval(keepAlive);
        } else if (connection.readyState === WebSocket.OPEN) {
          connection.ping();
        } else {
          clearInterval(keepAlive);
        }
      }, 30000);
    })
    .on('close', (code: number, reason: string) => {
      if (!keyReceived) {
        if (code === 1005) {
          api.store.dispatch(setLoginId(undefined));
          cancelLogin = undefined;
          bringToFront();
          callback(new UserCanceled());
        } else if (attempts-- > 0) {
          // automatic reconnect
          legacyConnect(api, callback);
        } else {
          cancelLogin = undefined;
          bringToFront();
          api.store.dispatch(setLoginId('__failed'));
          api.store.dispatch(setLoginError((error !== undefined)
            ? prettifyNodeErrorMessage(error).message
            : 'Log-in connection closed prematurely'));

          let err = error;
          if (err === undefined) {
            err = new ProcessCanceled(
              `Log-in connection closed prematurely (Code ${code})`);
          }
          callback(err);
        }
      }
    })
    .on('pong', () => {
      connectionAlive = true;
      attempts = 5;
    })
    .on('message', data => {
      try {
        const response = JSON.parse(data.toString());

        if (response.success) {
          if (response.data.connection_token !== undefined) {
            loginMessage.token = response.data.connection_token;
          } else if (response.data.api_key !== undefined) {
            connection.close();
            api.store.dispatch(setLoginId(undefined));
            api.store.dispatch(setUserAPIKey(response.data.api_key));
            bringToFront();
            keyReceived = true;
            callback(null);
          }
        } else {
          const err = new Error(response.error);
          callback(err);
        }
      } catch (err) {
        if (err.message.startsWith('Unexpected token')) {
          err.message = 'Failed to parse: ' + data.toString();
        }
        callback(err);
      }
    })
    .on('error', err => {
      // Cloudflare will serve 503 service unavailable errors when/if
      //  it is unable to reach the SSO server.
      error = err.message.startsWith('Unexpected server response')
        ? new ServiceTemporarilyUnavailable('Login')
        : err;

      connection.close();
    });
}
*/

const oauth = new OAuth({
  baseUrl: OAUTH_URL,
  clientId: OAUTH_CLIENT_ID,
  redirectUrl: OAUTH_REDIRECT_URL, // Keep for backward compatibility
  getRedirectUrl: getOAuthRedirectUrl, // Use the new function
});

export function requestLogin(
  nexus: Nexus,
  api: IExtensionApi,
  callback: (err: Error) => void,
) {
  const stackErr = new Error();

  return oauth
    .sendRequest(
      async (err: Error, token: ITokenReply) => {
        // received reply from site for this state

        void bringToFront();
        api.store.dispatch(setLoginId(undefined));
        // set state to undefined so that we can close the modal?
        api.store.dispatch(setDialogVisible(undefined));
        api.store.dispatch(setOauthPending(undefined));

        if (err !== null) {
          return callback(err);
        }

        const tokenDecoded: IJWTAccessToken = jwt.decode(token.access_token);
        //log('info', 'JWT Token', { token: token.access_token });

        api.store.dispatch(
          setOAuthCredentials(
            token.access_token,
            token.refresh_token,
            tokenDecoded.fingerprint,
          ),
        );

        callback(null);
      },
      (url: string) => {
        // url has been generated by sentRequest

        // open browser with oauth url
        opn(url).catch(() => null);
        // set state to url
        api.store.dispatch(setOauthPending(url));
      },
    )
    .catch((unknownError) => {
      const err = unknownToError(unknownError);
      err.stack = stackErr.stack;
      callback(err);
    });
}

export function oauthCallback(
  api: IExtensionApi,
  code: string,
  state?: string,
) {
  // the result of this is reported to the callback from requestLogin;
  return oauth.receiveCode(code, state);
}

export function ensureLoggedIn(api: IExtensionApi): BluebirdPromise<void> {
  if (!isLoggedIn(api.getState())) {
    return new BluebirdPromise((resolve, reject) => {
      api.events.on("did-login", (err: Error) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });

      api.store.dispatch(setDialogVisible("login-dialog"));
    });
  } else {
    return BluebirdPromise.resolve();
  }
}

export function startDownload(
  api: IExtensionApi,
  nexus: Nexus,
  nxmurl: string,
  redownload?: RedownloadMode,
  fileName?: string,
  allowInstall?: boolean,
  handleErrors: boolean = true,
  referenceTag?: string,
): BluebirdPromise<string> {
  let url: NXMUrl;

  log("debug", "start download", { fileName, referenceTag });
  try {
    url = new NXMUrl(nxmurl);
  } catch (err) {
    return BluebirdPromise.reject(err);
  }

  if (["vortex", "site"].includes(url.gameId) && url.view) {
    api.events.emit("show-extension-page", url.modId);
    return BluebirdPromise.reject(new DownloadIsHTML(nxmurl));
  }

  if (!["mod", "collection"].includes(url.type)) {
    return BluebirdPromise.reject(new ProcessCanceled("Not a download url"));
  }

  return url.type === "mod"
    ? startDownloadMod(
        api,
        nexus,
        nxmurl,
        url,
        redownload,
        fileName,
        allowInstall,
        handleErrors,
        referenceTag,
      )
    : startDownloadCollection(
        api,
        nexus,
        nxmurl,
        url,
        handleErrors,
        referenceTag,
      );
}

function startDownloadCollection(
  api: IExtensionApi,
  nexus: Nexus,
  urlStr: string,
  url: NXMUrl,
  handleErrors: boolean = true,
  referenceTag?: string,
): BluebirdPromise<string> {
  const state: IState = api.getState();
  const games = knownGames(state);
  const gameId = convertNXMIdReverse(games, url.gameId);
  const pageId = nexusGameId(gameById(state, gameId), url.gameId);
  let revisionInfo: Partial<IRevision>;

  const revNumber = url.revisionNumber >= 0 ? url.revisionNumber : undefined;

  return BluebirdPromise.resolve(
    nexus.getCollectionRevisionGraph(
      FULL_REVISION_INFO,
      url.collectionSlug,
      revNumber,
    ),
  )
    .then((revision) => {
      revisionInfo = revision;
      api.sendNotification({
        id: revision.id.toString(),
        type: "global",
        message: "Downloading Collection",
        displayMS: 40000,
      });
      return nexus.getCollectionDownloadLink(revision.downloadLink);
    })
    .then((downloadUrls) => {
      return toPromise<string>((cb) =>
        api.events.emit(
          "start-download",
          (downloadUrls ?? []).map((iter) => iter.URI),
          {
            game: gameId,
            source: "nexus",
            name: revisionInfo.collection?.name,
            referenceTag,
            nexus: {
              ids: {
                gameId: pageId,
                collectionId: revisionInfo.collectionId,
                revisionId: revisionInfo.id,
                collectionSlug: url.collectionSlug,
                revisionNumber:
                  revisionInfo.revisionNumber ?? url.revisionNumber,
              },
              revisionInfo,
            },
          },
          (revisionInfo as any).file_name,
          cb,
          undefined,
          { allowInstall: false },
        ),
      ).catch((err) => BluebirdPromise.reject(contextify(err)));
    })
    .tap((dlId) => api.events.emit("did-download-collection", dlId))
    .catch((err) => {
      err["collectionSlug"] = url.collectionSlug;
      err["revisionNumber"] =
        revisionInfo?.revisionNumber ?? url.revisionNumber;
      if (!handleErrors) {
        return BluebirdPromise.reject(err);
      }
      if (err.code === "NOT_FOUND") {
        api.showErrorNotification(
          "Failed to download collection",
          "The collection was not found. This usually happens when you try to download " +
            "an unpublished collection.",
          { allowReport: false },
        );
      } else if (!(err instanceof UserCanceled)) {
        api.showErrorNotification("Failed to download collection", err, {
          allowReport: !(err instanceof ProcessCanceled),
        });
      }
      return null;
    });
}

export interface IRemoteInfo {
  modInfo?: IModInfo;
  fileInfo?: IFileInfo;
  revisionInfo?: Partial<IRevision>;
}

export function getInfo(
  nexus: Nexus,
  domain: string,
  modId: number,
  fileId: number,
): BluebirdPromise<IRemoteInfo> {
  return BluebirdPromise.resolve(
    (async () => {
      try {
        // Run both API calls concurrently for better performance
        const [modInfo, fileInfo] = await Promise.all([
          nexus.getModInfo(modId, domain),
          nexus.getFileInfo(modId, fileId, domain),
        ]);
        return { modInfo, fileInfo };
      } catch (err) {
        err["attachLogOnReport"] = true;
        throw err;
      }
    })(),
  );
}

// GraphQL-based version of getInfo function
export function getInfoGraphQL(
  nexus: Nexus,
  domain: string,
  modId: number,
  fileId: number,
): BluebirdPromise<IRemoteInfo> {
  // Define the GraphQL query for file information
  const fileQuery: Partial<IModFileQuery> = {
    categoryId: true,
    count: true,
    date: true,
    description: true,
    fileId: true,
    mod: {
      author: true,
      category: true,
      game: {
        id: true,
        domainName: true,
      },
      gameId: true,
      id: true,
      modCategory: {
        id: true,
        name: true,
      },
      pictureUrl: true,
      status: true,
      uid: true,
    },
    modId: true,
    name: true,
    primary: true,
    size: true,
    uid: true,
    uri: true,
    version: true,
  } as any;

  // Ensure the nexus games cache is loaded before constructing UIDs,
  // as makeFileUID needs the games list to convert domain names to numeric IDs
  return nexusGamesProm().then(
    () =>
      new BluebirdPromise((resolve, reject) => {
        const uid = makeFileUID({
          fileId: fileId.toString(),
          modId: modId.toString(),
          gameId: domain,
        });

        if (uid === undefined) {
          return reject(
            new Error(
              `Unable to create file UID for game "${domain}", mod ${modId}, file ${fileId}`,
            ),
          );
        }

        nexus
          .modFilesByUid(fileQuery, [uid])
          .then((fileResult) => {
            if (!fileResult?.[0]) {
              return reject(
                new Error(
                  `File not found on Nexus: game "${domain}", mod ${modId}, file ${fileId}`,
                ),
              );
            }
            const fileInfo = transformGraphQLFileToIFileInfo(fileResult[0]);
            const modInfo = transformGraphQLModToIModInfo(fileResult[0]);
            return resolve({ modInfo, fileInfo });
          })
          .catch((err) => {
            const error = unknownToError(err);
            error["attachLogOnReport"] = true;
            return reject(error);
          });
      }),
  );
}

// Helper function to transform GraphQL mod data to IModInfo format
function transformGraphQLModToIModInfo(file: Partial<IModFile>): IModInfo {
  const mod = file.mod;
  const modUploader: IGraphUser = mod?.uploader;
  const res: IModInfo = {
    endorsement_count: mod?.endorsements || 0,
    mod_id: file.modId || mod?.id,
    name: mod?.name,
    summary: mod?.summary,
    description: mod?.description,
    picture_url: mod?.pictureUrl,
    version: mod?.version,
    author: mod?.author || modUploader?.name || "",
    uploaded_by: modUploader?.name || mod?.author || "",
    uploaded_users_profile_url: modUploader?.memberId
      ? `https://www.nexusmods.com/users/${modUploader?.memberId}`
      : "",
    allow_rating: true, // Default value, might need to be fetched separately
    category_id: mod?.modCategory?.id
      ? Number.parseInt(mod.modCategory.id, 10)
      : undefined,
    user: {
      member_id: modUploader?.memberId,
      name: modUploader?.name,
      avatar: modUploader?.avatar,
      member_group_id: null, // We're not using this anywhere right now anyway
    },
    created_time: mod?.createdAt,
    updated_time: mod?.updatedAt,
    created_timestamp: mod?.createdAt ? new Date(mod.createdAt).getTime() : 0,
    updated_timestamp: mod?.updatedAt ? new Date(mod.updatedAt).getTime() : 0,
    game_id: mod?.gameId || mod?.game?.id,
    domain_name: mod?.game?.domainName,
    contains_adult_content: mod?.adultContent || false,
    status: (mod?.status || "published") as ModStatus,
    available: true, // Not sure why this is here, leaving it as true for now.
    mod_downloads: file.totalDownloads || 0,
    mod_unique_downloads: file.uniqueDownloads || 0,
    requirements: mod?.modRequirements,
  };
  return res;
}

// Helper function to transform GraphQL file data to IFileInfo format
function transformGraphQLFileToIFileInfo(file: Partial<IModFile>): IFileInfo {
  const sizeInBytes: number = file.sizeInBytes
    ? Number.parseInt(file.sizeInBytes, 10)
    : file.size || 0;
  const res: IFileInfo = {
    file_id: file.fileId || parseInt(file.uid?.split(":")[2], 10) || 0,
    name: file.name,
    version: file.version,
    category_name: file.mod?.category || "",
    category_id: file.categoryId || 1,
    is_primary: file.primary === file.fileId || false,
    size: sizeInBytes,
    size_kb: Math.round(sizeInBytes / 1024),
    uploaded_timestamp: file.mod?.updatedAt
      ? new Date(file.mod.updatedAt).getTime()
      : file.date,
    uploaded_time: file.mod?.updatedAt || new Date(file.date).toString(),
    changelog_html: null, // Changelog HTML is not included in the GraphQL response
    file_name: file.uri,
    description: file.description || "",
    content_preview_link: "", // Default value
    external_virus_scan_url: "", // Default value
    mod_version: file.mod?.version || file.version,
  };
  return res;
}

export function getCollectionInfo(
  nexus: Nexus,
  collectionSlug: string,
  revisionNumber: number,
  revisionId: number,
): BluebirdPromise<IRemoteInfo> {
  const query: IRevisionQuery = {
    adultContent: true,
    id: true,
    collection: {
      viewerIsBlocked: true,
      permissions: {
        global: true,
        key: true,
      },
      category: {
        id: true,
        name: true,
      },
      id: true,
      slug: true,
      createdAt: true,
      endorsements: true,
      name: true,
      summary: true,
      description: true,
      user: {
        name: true,
        memberId: true,
        avatar: true,
      },
      tileImage: {
        url: true,
      },
    },
    createdAt: true,
    updatedAt: true,
    installationInfo: true,
    revisionNumber: true,
    rating: {
      average: true,
      total: true,
    },
  };

  if (revisionNumber <= 0) {
    revisionNumber = undefined;
  }

  return BluebirdPromise.resolve(
    nexus.getCollectionRevisionGraph(query, collectionSlug, revisionNumber),
  )
    .then((revision) => ({ revisionInfo: revision }))
    .catch((err) => {
      err["collectionSlug"] = collectionSlug;
      err["revisionNumber"] = revisionNumber;
      err["revisionId"] = revisionId;
      return BluebirdPromise.reject(err);
    });
}

function startDownloadMod(
  api: IExtensionApi,
  nexus: Nexus,
  urlStr: string,
  url: NXMUrl,
  redownload?: RedownloadMode,
  fileName?: string,
  allowInstall?: boolean,
  handleErrors: boolean = true,
  referenceTag?: string,
): BluebirdPromise<string> {
  log("info", "start download mod", { urlStr, allowInstall });
  let state = api.getState();
  const games = knownGames(state);
  const gameId = convertNXMIdReverse(games, url.gameId);
  const pageId = nexusGameId(gameById(state, gameId), url.gameId);

  let nexusFileInfo: IFileInfo;
  return getInfoGraphQL(nexus, pageId, url.modId, url.fileId)
    .then(({ modInfo, fileInfo }) => {
      nexusFileInfo = fileInfo;
      return new BluebirdPromise<string>((resolve, reject) => {
        api.events.emit(
          "start-download",
          [urlStr],
          {
            game: gameId,
            source: "nexus",
            name: fileInfo.name,
            referenceTag,
            nexus: {
              ids: { gameId: pageId, modId: url.modId, fileId: url.fileId },
              modInfo,
              fileInfo,
            },
          },
          fileName ?? nexusFileInfo.file_name,
          (err, downloadId) =>
            truthy(err) ? reject(contextify(err)) : resolve(downloadId),
          redownload,
          { allowInstall },
        );
      });
    })
    .tap(() => {
      api.sendNotification({
        id: url.fileId.toString(),
        type: "global",
        title: "Downloading from Nexus",
        message: nexusFileInfo.name,
        displayMS: 4000,
        noToast: true,
      });
    })
    .then((downloadId) => {
      if (gameId === SITE_ID) {
        return downloadId;
      }
      state = api.getState();
      const download = state.persistent.downloads.files[downloadId];
      // might be paused at this point
      if (
        !state.settings.automation?.install &&
        download?.state === "finished"
      ) {
        api.sendNotification({
          id: `ready-to-install-${downloadId}`,
          type: "success",
          title: "Download finished",
          group: "download-finished",
          message: nexusFileInfo.name,
          actions: [
            {
              title: "Install All",
              action: (dismiss) => {
                api.events.emit(
                  "start-install-download",
                  downloadId,
                  undefined,
                  (err: any, id: string) => {
                    if (err) {
                      processInstallError(
                        api,
                        err,
                        downloadId,
                        fileName ?? nexusFileInfo.file_name,
                      );
                    }
                  },
                );
                dismiss();
              },
            },
          ],
        });
      }
      return downloadId;
    })
    .catch((err) => {
      if (!handleErrors) {
        return BluebirdPromise.reject(err);
      }
      const t = api.translate;
      // Handle "UNKNOWN" error code with errno 22 (EINVAL) as a non-fatal, warning.
      if (err.code === "UNKNOWN" && err.errno === 22) {
        api.sendNotification({
          id: url.fileId?.toString?.() ?? "unknown-download-error",
          type: "warning",
          title: "Download failed",
          message: t(
            "The operation completed successfully, but the file could not be processed. " +
              "This may be due to a temporary issue or a problem with the downloaded file. Please " +
              "try again or check the file integrity.",
          ),
          localize: {
            message: false,
          },
        });
      } else if (
        err.message ===
        "Provided key and expire time isn't correct for this user/file."
      ) {
        const userName = getSafe(
          state,
          ["persistent", "nexus", "userInfo", "name"],
          undefined,
        );
        api.sendNotification({
          id: url.fileId.toString(),
          type: "warning",
          title: "Download failed",
          message:
            userName === undefined
              ? t("You need to be logged in to Nexus Mods.")
              : t(
                  "The link was not created for this account ({{ userName }}). You have to be logged " +
                    "into nexusmods.com with the same account that you use in Vortex.",
                  {
                    replace: {
                      userName,
                    },
                  },
                ),
          localize: {
            message: false,
          },
        });
      } else if (err instanceof RateLimitError) {
        api.sendNotification({
          id: "rate-limit-exceeded",
          type: "warning",
          title: "Rate-limit exceeded",
          message:
            "You wont be able to use network features until the next full hour.",
        });
      } else if (err instanceof NexusError) {
        const detail = processErrorMessage(err);
        let allowReport = detail.Servermessage === undefined;
        if (detail.noReport) {
          allowReport = false;
          delete detail.noReport;
        }
        showError(api.store.dispatch, "Download failed", detail, {
          allowReport,
        });
      } else if (err.statusCode >= 400) {
        api.showErrorNotification("Download failed", err, {
          allowReport: false,
        });
      } else if (err instanceof HTTPError) {
        api.showErrorNotification(
          "Download failed",
          {
            error: err,
            message: "This may be a temporary issue, please try again later",
          },
          { allowReport: false },
        );
      } else if (err instanceof TimeoutError) {
        api.showErrorNotification("Download failed", err, {
          allowReport: false,
        });
      } else if (err instanceof ProcessCanceled) {
        api.showErrorNotification(
          "Download failed",
          {
            error: err,
            message: "This may be a temporary issue, please try again later",
          },
          { allowReport: false },
        );
      } else if (
        err.message.indexOf("DECRYPTION_FAILED_OR_BAD_RECORD_MAC") !== -1 ||
        err.message.indexOf("WRONG_VERSION_NUMBER") !== -1 ||
        err.message.indexOf("BAD_SIGNATURE") !== -1 ||
        err.message.indexOf("TLSV1_ALERT_ACCESS_DENIED") !== -1
      ) {
        api.showErrorNotification(
          "Download failed",
          {
            error: err,
            message: "This may be a temporary issue, please try again later",
          },
          { allowReport: false },
        );
      } else if (err instanceof TemporaryError) {
        api.showErrorNotification(
          "Download failed",
          {
            error: err,
            message: "This may be a temporary issue, please try again later",
          },
          { allowReport: false },
        );
      } else if (err instanceof AlreadyDownloaded) {
        return err.downloadId;
      } else if (err instanceof UserCanceled) {
        // nop
      } else if (err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
        api.showErrorNotification(
          "Download failed",
          {
            error: err,
            message: "Certificate validation failed",
          },
          { allowReport: false },
        );
      } else if (IGNORE_ERRORS.includes(err["code"])) {
        api.showErrorNotification(
          "Download failed",
          {
            error: err,
            message: "This may be a temporary issue, please try again later",
          },
          { allowReport: false },
        );
      } else {
        const allowReport =
          err["nativeCode"] != null || [225].indexOf(err["nativeCode"]) === -1;
        api.showErrorNotification("Download failed", err, { allowReport });
      }
      log("warn", "failed to get mod info", { err: util.inspect(err) });
      return null;
    });
}

interface IRequestError {
  message: string;
  Servermessage?: string;
  URL?: string;
  Game?: string;
  stack?: string;
  fatal?: boolean;
  Mod?: number;
  Collection?: number;
  Revision?: number;
  Version?: string;
  noReport?: boolean;
}

function expectedErrorMessage(code: string): string {
  switch (code) {
    case "TOO_SOON_AFTER_DOWNLOAD":
      return "You have to wait 15 minutes before endorsing a mod.";
    case "NOT_DOWNLOADED_MOD":
      return "You have not downloaded this mod (with this account).";
    case "API_UNREACHABLE":
      return "The server API is currently not reachable, please try again later";
    default:
      return undefined;
  }
}

export function processErrorMessage(err: NexusError): IRequestError {
  const errorMessage = typeof err === "string" ? err : err.message;
  if (err.statusCode === undefined) {
    if (
      errorMessage &&
      (errorMessage.indexOf("APIKEY") !== -1 ||
        errorMessage.indexOf("API Key") !== -1)
    ) {
      return {
        message: "You are not logged in to Nexus Mods!",
        noReport: true,
      };
    } else {
      const res: IRequestError = { message: errorMessage };
      if (err.stack !== undefined) {
        res.stack = err.stack;
      }
      return res;
    }
  } else if (err.statusCode >= 400 && err.statusCode < 500) {
    const expected = expectedErrorMessage(err.code);
    return {
      message:
        expected ??
        "Server couldn't process this request.\nMaybe the locally stored " +
          "info about the mod is wrong\nor the mod was removed from Nexus.",
      Servermessage: errorMessage,
      URL: err.request,
      fatal: errorMessage === undefined,
    };
  } else if (err.statusCode >= 500 && err.statusCode < 600) {
    return {
      message: "The server reported an internal error. Please try again later.",
      Servermessage: errorMessage,
      URL: err.request,
      noReport: true,
    };
  } else if (errorMessage.includes("unable to get local issuer certificate")) {
    return {
      message: "Secure communication with server failed",
      Servermessage: errorMessage,
      URL: err.request,
      noReport: true,
    };
  } else {
    return {
      message: "Unexpected error reported by the server",
      Servermessage:
        (errorMessage || "") + " ( Status Code: " + err.statusCode + ")",
      URL: err.request,
      stack: err.stack,
    };
  }
}

export function resolveGraphError(
  t: TFunction,
  isLoggedIn: boolean,
  err: Error,
): string {
  if (err.message === "You must provide a version") {
    // is this still reported in this way?
    return t("You can't endorse a mod that has no version set.");
  }

  const msg = {
    NOT_DOWNLOADED_MOD: "You have not downloaded this mod from Nexus Mods yet.",
    TOO_SOON_AFTER_DOWNLOAD:
      "You have to wait {{waitingTime}} after downloading before you can endorse/rate things.",
    IS_OWN_MOD: "You can't endorse your own mods.",
    IS_OWN_CONTENT: "You can't endorse your own content.",
    UNAUTHORIZED: isLoggedIn
      ? "You cannot interact with this collection because you have been blocked by the curator."
      : "You have to be logged in to vote.",
  }[err["code"]];

  return msg;
}

const IGNORE_ERRORS = [
  "ENOENT",
  "EPROTO",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
];

function reportEndorseError(
  api: IExtensionApi,
  err: Error,
  type: "mod" | "collection",
  gameId: string,
  modId: number,
  version?: string,
) {
  const loggedIn = isLoggedIn(api.getState());
  const expectedError = resolveGraphError(api.translate, loggedIn, err);
  if (expectedError !== undefined) {
    api.sendNotification({
      type: "info",
      message: expectedError,
      replace: {
        waitingTime:
          type === "mod"
            ? api.translate("15 minutes")
            : api.translate("12 hours"),
      },
    });
  } else if (err instanceof TimeoutError) {
    const message = `A timeout occurred trying to endorse the ${type}, please try again later.`;
    api.sendNotification({
      type: "error",
      title: "Timeout",
      message,
      displayMS: calcDuration(message.length),
    });
  } else if (
    IGNORE_ERRORS.includes(err["code"]) ||
    err instanceof ProcessCanceled ||
    (err?.message ?? "").includes("getaddrinfo")
  ) {
    api.showErrorNotification(
      `Endorsing ${type} failed, please try again later`,
      err,
      {
        allowReport: false,
      },
    );
  } else {
    const detail = processErrorMessage(err as NexusError);
    detail.Game = gameId ?? activeGameId(api.getState());
    if (type === "mod") {
      detail.Mod = modId;
    } else {
      detail.Collection = modId;
    }
    if (version !== undefined) {
      detail.Version = version;
    }
    let allowReport = detail.Servermessage === undefined;
    if (detail.noReport) {
      allowReport = false;
      delete detail.noReport;
    }
    showError(
      api.store.dispatch,
      `An error occurred endorsing a ${type}`,
      detail,
      { allowReport },
    );
  }
}

export function endorseDirectImpl(
  api: IExtensionApi,
  nexus: Nexus,
  gameId: string,
  nexusId: number,
  version: string,
  endorsedStatus: string,
): BluebirdPromise<string> {
  return endorseMod(nexus, gameId, nexusId, version, endorsedStatus).catch(
    (err) => {
      reportEndorseError(api, err, "mod", gameId, nexusId, version);
      return endorsedStatus as EndorsedStatus;
    },
  );
}

export function endorseThing(
  api: IExtensionApi,
  nexus: Nexus,
  gameId: string,
  modId: string,
  endorsedStatus: string,
) {
  const { store } = api;
  const gameMode = activeGameId(store.getState());
  const mod: IMod = getSafe(
    store.getState(),
    ["persistent", "mods", gameMode, modId],
    undefined,
  );

  if (mod === undefined) {
    log("warn", "tried to endorse unknown mod", { gameId, modId });
    return;
  }

  if (mod.attributes?.modId !== undefined) {
    endorseModImpl(api, nexus, gameMode, mod, endorsedStatus);
  } else if (mod.attributes?.collectionId !== undefined) {
    endorseCollectionImpl(api, nexus, gameMode, mod, endorsedStatus);
  }
}

function convertCollectionEndorseStatus(input: string): string {
  // transform collection endorsed status to match what we store for mods

  return _.capitalize(input);
}

function endorseCollectionImpl(
  api: IExtensionApi,
  nexus: Nexus,
  gameMode: string,
  mod: IMod,
  endorsedStatus: string,
) {
  const { store } = api;

  const gameId = mod.attributes?.downloadGame;

  const nexusCollectionId: number | undefined = mod.attributes?.collectionId
    ? parseInt(String(mod.attributes.collectionId), 10)
    : undefined;

  if (nexusCollectionId === undefined) {
    log("warn", "tried to endorse collection with no nexus collection id", {
      gameId,
      modId: mod.id,
    });
    return;
  }

  store.dispatch(setModAttribute(gameId, mod.id, "endorsed", "pending"));
  const game = gameById(api.store.getState(), gameId);
  endorseCollection(nexus, nexusGameId(game), nexusCollectionId, endorsedStatus)
    .then((result: { success: boolean; endorsement: { status: string } }) => {
      store.dispatch(
        setModAttribute(
          gameMode,
          mod.id,
          "endorsed",
          convertCollectionEndorseStatus(result.endorsement.status),
        ),
      );
    })
    .catch((err: Error | NexusError) => {
      store.dispatch(
        setModAttribute(gameMode, mod.id, "endorsed", "Undecided"),
      );
      reportEndorseError(api, err, "collection", gameId, nexusCollectionId);
    });
}

function endorseModImpl(
  api: IExtensionApi,
  nexus: Nexus,
  gameMode: string,
  mod: IMod,
  endorsedStatus: string,
) {
  const { store } = api;

  const gameId = mod.attributes?.downloadGame;

  const nexusModId: number | undefined = mod.attributes?.modId
    ? parseInt(String(mod.attributes.modId), 10)
    : undefined;
  if (nexusModId === undefined) {
    log("warn", "tried to endorse mod with no nexus mod id", {
      gameId,
      modId: mod.id,
    });
    return;
  }
  const version: string =
    getSafe(mod.attributes, ["version"], undefined) ||
    getSafe(mod.attributes, ["modVersion"], undefined);

  if (!truthy(version)) {
    api.sendNotification({
      type: "info",
      message: api.translate(
        "You can't endorse a mod that has no version set.",
      ),
    });
    return;
  }

  store.dispatch(setModAttribute(gameId, mod.id, "endorsed", "pending"));
  const game = gameById(api.store.getState(), gameId);
  endorseMod(nexus, nexusGameId(game), nexusModId, version, endorsedStatus)
    .then((endorsed: string) => {
      store.dispatch(setModAttribute(gameMode, mod.id, "endorsed", endorsed));
    })
    .catch((err: Error | NexusError) => {
      store.dispatch(
        setModAttribute(gameMode, mod.id, "endorsed", "Undecided"),
      );
      reportEndorseError(api, err, "mod", gameId, nexusModId, version);
    });
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

function nexusLink(state: IState, mod: IMod, gameMode: string) {
  const gameId = nexusGameId(
    gameById(
      state,
      getSafe(mod.attributes, ["downloadGame"], undefined) || gameMode,
    ),
  );
  if (mod.attributes?.collectionSlug !== undefined) {
    return `https://www.nexusmods.com/${gameId}/mods/${mod.attributes?.collectionSlug}`;
  } else {
    const nexusModId: number = parseInt(
      getSafe(mod.attributes, ["modId"], undefined),
      10,
    );
    return `https://www.nexusmods.com/${gameId}/mods/${nexusModId}`;
  }
}

export function refreshEndorsements(store: Redux.Store<any>, nexus: Nexus) {
  return BluebirdPromise.resolve(nexus.getEndorsements()).then(
    (endorsements) => {
      const endorseMap: {
        [gameId: string]: { [modId: string]: EndorsedStatus };
      } = endorsements.reduce((prev, endorsement: IEndorsement) => {
        // can't trust anyone these days...
        if (
          endorsement.domain_name === undefined ||
          endorsement.status === undefined ||
          endorsement.mod_id === undefined
        ) {
          return prev;
        }

        const gameId = convertGameIdReverse(
          knownGames(store.getState()),
          endorsement.domain_name,
        );
        const modId = endorsement.mod_id;
        if (prev[gameId] === undefined) {
          prev[gameId] = {};
        }
        prev[gameId][modId] = endorsement.status;
        return prev;
      }, {});
      const state: IState = store.getState();
      Object.keys(state.session.extensions.installed).forEach((extId) => {
        const modId = state.session.extensions.installed[extId].modId;

        if (modId !== undefined) {
          const endorsed = getSafe(endorseMap, [SITE_ID, modId], "Undecided");
          store.dispatch(setExtensionEndorsed(extId, endorsed));
        }
      });
      const allMods = state.persistent.mods;
      Object.keys(allMods).forEach((gameId) => {
        Object.keys(allMods[gameId]).forEach((modId) => {
          const dlGame = getSafe(
            allMods,
            [gameId, modId, "attributes", "downloadGame"],
            gameId,
          );
          const nexModId = getSafe(
            allMods,
            [gameId, modId, "attributes", "modId"],
            undefined,
          );
          const oldEndorsed = getSafe(
            allMods,
            [gameId, modId, "attributes", "endorsed"],
            "Undecided",
          );
          const endorsed = getSafe(endorseMap, [dlGame, nexModId], "Undecided");
          if (endorsed !== oldEndorsed) {
            store.dispatch(
              setModAttribute(gameId, modId, "endorsed", endorsed),
            );
          }
        });
      });
    },
  );
}

function filterByUpdateList(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  input: IMod[],
): BluebirdPromise<IMod[]> {
  const getGameId = (mod: IMod) =>
    getSafe(mod.attributes, ["downloadGame"], undefined) || gameId;

  // all game ids for which we have mods installed
  const gameIds = Array.from(new Set(input.map(getGameId)));

  interface IMinAgeMap {
    [gameId: string]: number;
  }
  interface IUpdateMap {
    [gameId: string]: IUpdateEntry[];
  }

  // for each game, stores the update time of the least recently updated mod
  const minAge: IMinAgeMap = input.reduce((prev: IMinAgeMap, mod: IMod) => {
    const modGameId = getGameId(mod);
    const lastUpdate = getSafe(mod.attributes, ["lastUpdateTime"], undefined);
    if (
      lastUpdate !== undefined &&
      (prev[modGameId] === undefined || prev[modGameId] > lastUpdate)
    ) {
      prev[modGameId] = lastUpdate;
    }
    return prev;
  }, {});

  return BluebirdPromise.reduce(
    gameIds,
    (prev: IUpdateMap, iterGameId: string) =>
      // minAge map may be missing certain gameIds when none of the installed mods
      //  for that gameId have the lastUpdateTime attribute. We still want to check for
      //  updates in this scenario - the lastUpdateTime attribute will be populated immediately
      //  after the update.
      fetchRecentUpdates(
        store,
        nexus,
        iterGameId,
        minAge[iterGameId] || 0,
      ).then((entries) => {
        prev[iterGameId] = entries;
        return prev;
      }),
    {},
  ).then((updateLists: IUpdateMap) => {
    const updateMap: { [gameId: string]: { [modId: string]: number } } = {};

    Object.keys(updateLists).forEach((iterGameId) => {
      updateMap[iterGameId] = updateLists[iterGameId].reduce((prev, entry) => {
        prev[entry.mod_id] =
          Math.max(
            (entry as any).latest_file_update,
            (entry as any).latest_mod_activity,
          ) * 1000;
        return prev;
      }, {});
    });

    const now = Date.now();

    return input.filter((mod) => {
      const modGameId = getGameId(mod);
      if (updateMap[modGameId] === undefined) {
        // the game hasn't been checked for updates for so long we can't fetch an update range
        // long enough
        return true;
      }
      const lastUpdate = getSafe(mod.attributes, ["lastUpdateTime"], 0);
      // check anything for updates that is either in the update list and has been updated as
      // well as anything that has last been checked before the range of the update list
      return (
        lastUpdate < getSafe(updateMap, [modGameId, mod.attributes.modId], 1) ||
        now - lastUpdate > 28 * ONE_DAY
      );
    });
  });
}

export function checkForCollectionUpdates(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  mods: { [modId: string]: IMod },
): BluebirdPromise<{ errorMessages: string[]; updatedIds: string[] }> {
  const collectionIds = Object.keys(mods).filter(
    (modId) => mods[modId].attributes?.collectionId !== undefined,
  );

  return BluebirdPromise.all(
    collectionIds.map((modId) => {
      const query: Partial<ICollectionQuery> = {
        viewerIsBlocked: true,
        permissions: {
          global: true,
          key: true,
        },
        revisions: {
          revisionNumber: true,
          id: true,
          revisionStatus: true,
        },
      };
      const mod = mods[modId];
      return nexus
        .getCollectionGraph(query, mod.attributes?.collectionSlug)
        .then((collection) => {
          const currentRevision = collection.revisions
            .filter((rev) => rev.revisionStatus === "published")
            .sort((lhs, rhs) => rhs.revisionNumber - lhs.revisionNumber)[0];

          const batched = [
            setModAttribute(gameId, modId, "lastUpdateTime", Date.now()),
          ];
          if (
            currentRevision?.id !== mod.attributes?.revisionId &&
            currentRevision?.revisionNumber !== undefined
          ) {
            batched.push(
              setModAttribute(
                gameId,
                modId,
                "newestFileId",
                currentRevision.revisionNumber,
              ),
            );
            batched.push(
              setModAttribute(
                gameId,
                modId,
                "newestVersion",
                currentRevision.revisionNumber.toString(),
              ),
            );
          }
          batchDispatch(store, batched);
          return undefined;
        })
        .catch((err) => {
          const name = modName(mod, { version: true });
          const nameLink = `[url=${nexusLink(store.getState(), mod, gameId)}]${name}[/url]`;
          return `${nameLink}:<br/>${getErrorMessageOrDefault(err)}`;
        });
    }),
  ).then((messages) => ({
    errorMessages: messages,
    updatedIds: collectionIds,
  }));
}

function checkForModUpdates(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  modsList: IMod[],
  forceFull: boolean | "silent",
  now: number,
) {
  return filterByUpdateList(store, nexus, gameId, modsList).then(
    (filteredMods: IMod[]) =>
      checkForModUpdatesImpl(
        store,
        nexus,
        gameId,
        modsList,
        filteredMods,
        forceFull,
        now,
      ),
  );
}

function checkForModUpdatesImpl(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  modsList: IMod[],
  filteredMods: IMod[],
  forceFull: boolean | "silent",
  now: number,
): BluebirdPromise<{ errorMessages: string[]; updatedIds: string[] }> {
  const filtered = new Set(filteredMods.map((mod) => mod.id));
  const tStore = store as ThunkStore<any>;
  let pos = 0;
  const progress = () => {
    tStore.dispatch(
      addNotification({
        id: "check-update-progress",
        type: "activity",
        message: "Checking mods for update",
        progress: (pos * 100) / filteredMods.length,
      }),
    );
    ++pos;
  };
  progress();
  if (forceFull) {
    log("info", "[update check] forcing full update check (nexus)", {
      count: modsList.length,
    });
  } else {
    log("info", "[update check] optimized update check (nexus)", {
      count: filteredMods.length,
      of: modsList.length,
    });
  }

  const updatedIds: string[] = [];
  const updatesMissed: IMod[] = [];

  const verP = ["attributes", "version"];
  const fileIdP = ["attributes", "fileId"];
  const newWerP = ["attributes", "newestVersion"];
  const newFileIdP = ["attributes", "newestFileId"];

  return BluebirdPromise.map(
    modsList,
    (mod: IMod) => {
      if (!forceFull && !filtered.has(mod.id)) {
        store.dispatch(
          setModAttribute(
            gameId,
            mod.id,
            "lastUpdateTime",
            now - 15 * ONE_MINUTE,
          ),
        );
        return;
      }

      return checkModVersion(store, nexus, gameId, mod)
        .then(() => {
          const modNew = getSafe(
            store.getState(),
            ["persistent", "mods", gameId, mod.id],
            undefined,
          );

          const newestVerChanged =
            getSafe(modNew, newWerP, undefined) !==
            getSafe(mod, newWerP, undefined);
          const verChanged =
            getSafe(modNew, newWerP, undefined) !==
            getSafe(modNew, verP, undefined);
          const newestFileIdChanged =
            getSafe(modNew, newFileIdP, undefined) !==
            getSafe(mod, newFileIdP, undefined);
          const fileIdChanged =
            getSafe(modNew, newFileIdP, undefined) !==
            getSafe(modNew, fileIdP, undefined);

          const updateFound =
            (newestVerChanged && verChanged) ||
            (newestFileIdChanged && fileIdChanged);

          if (updateFound) {
            updatedIds.push(mod.id);
            if (truthy(forceFull) && !filtered.has(mod.id)) {
              log(
                "warn",
                "[update check] Mod update would have been missed with regular check",
                {
                  modId: mod.id,
                  lastUpdateTime: getSafe(
                    mod,
                    ["attributes", "lastUpdateTime"],
                    0,
                  ),
                  "before.newestVersion": getSafe(mod, newWerP, ""),
                  "before.newestFileId": getSafe(mod, newFileIdP, ""),
                  "after.newestVersion": getSafe(modNew, newWerP, ""),
                  "after.newestFileId": getSafe(modNew, newFileIdP, ""),
                },
              );
              updatesMissed.push(mod);
            } else {
              log("info", "[update check] Mod update detected", {
                modId: mod.id,
                lastUpdateTime: getSafe(
                  mod,
                  ["attributes", "lastUpdateTime"],
                  0,
                ),
                "before.newestVersion": getSafe(mod, newWerP, ""),
                "before.newestFileId": getSafe(mod, newFileIdP, ""),
                "after.newestVersion": getSafe(modNew, newWerP, ""),
                "after.newestFileId": getSafe(modNew, newFileIdP, ""),
              });
            }

            store.dispatch(
              setModAttribute(gameId, mod.id, "lastUpdateTime", now),
            );
          }
        })
        .catch(TimeoutError, (err) => {
          const name = modName(mod, { version: true });
          return BluebirdPromise.resolve(`${name}:\nRequest timeout`);
        })
        .catch((err) => {
          const detail = processErrorMessage(err);
          if (detail.fatal) {
            return BluebirdPromise.reject(detail);
          }

          if (detail.message === undefined) {
            return BluebirdPromise.resolve(undefined);
          }

          const name = modName(mod, { version: true });
          const nameLink = `[url=${nexusLink(store.getState(), mod, gameId)}]${name}[/url]`;

          return detail.Servermessage !== undefined
            ? `${nameLink}:<br/>${detail.message}<br/>Server said: "${detail.Servermessage}"<br/>`
            : `${nameLink}:<br/>${detail.message}`;
        })
        .finally(() => {
          progress();
        });
    },
    { concurrency: 4 },
  )
    .finally(() => {
      log("info", "[update check] done");
      tStore.dispatch(dismissNotification("check-update-progress"));
      // if forceFull is 'silent' we show no notifications
      // if (forceFull === true) {
      //   if (updatesMissed.length === 0) {
      //     tStore.dispatch(addNotification({
      //       id: 'check-update-progress',
      //       type: 'info',
      //       message: 'Full update check found no updates that the regular check didn\'t.',
      //     }));
      //   } else {
      //     tStore.dispatch(addNotification({
      //       id: 'check-update-progress',
      //       type: 'info',
      //       message:
      //         'Full update found {{count}} updates that the regular check would have missed. '
      //         + 'Please send in a feedback with your log attached to help debug the cause.',
      //       replace: {
      //         count: updatesMissed.length,
      //       },
      //     }));
      //   }
      // }
    })
    .then((messages: string[]) => ({
      errorMessages: messages,
      updatedIds,
    }));
}

export function checkModVersionsImpl(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  mods: { [modId: string]: IMod },
  forceFull: boolean | "silent",
): BluebirdPromise<{ errors: string[]; modIds: string[] }> {
  const now = Date.now();

  const modsList: IMod[] = Object.keys(mods)
    .map((modId) => mods[modId])
    .filter((mod) => getSafe(mod.attributes, ["source"], undefined) === "nexus")
    .filter(
      (mod) =>
        now - (getSafe(mod.attributes, ["lastUpdateTime"], 0) || 0) >
        UPDATE_CHECK_DELAY,
    );
  log("info", "[update check] checking mods for update (nexus)", {
    count: modsList.length,
  });

  const updatedIds: string[] = [];

  return refreshEndorsements(store, nexus)
    .then(() =>
      BluebirdPromise.all([
        checkForCollectionUpdates(store, nexus, gameId, mods),
        checkForModUpdates(store, nexus, gameId, modsList, forceFull, now),
      ]),
    )
    .then(
      (
        result: Array<{ errorMessages: string[]; updatedIds: string[] }>,
      ): { errors: string[]; modIds: string[] } => ({
        errors: [].concat(
          ...result.map((r) =>
            r.errorMessages.filter((msg) => msg !== undefined),
          ),
        ),
        modIds: [].concat(...result.map((r) => r.updatedIds)),
      }),
    );
}

function errorFromNexusError(err: NexusError): string {
  switch (err.statusCode) {
    case 401:
      return "Login was refused, please review your API key.";
    default:
      return err.message;
  }
}

function getAccountStatus(apiUserInfo: IUserInfo): IAccountStatus {
  if (apiUserInfo.group_id === 5) return IAccountStatus.Banned;
  else if (apiUserInfo.group_id === 41) return IAccountStatus.Closed;
  else if (apiUserInfo.membership_roles.includes("premium"))
    return IAccountStatus.Premium;
  else if (
    apiUserInfo.membership_roles.includes("supporter") &&
    !apiUserInfo.membership_roles.includes("premium")
  )
    return IAccountStatus.Supporter;
  else return IAccountStatus.Free;
}

export function transformUserInfoFromApi(
  input: IUserInfo & { preferences: IPreference },
) {
  const stateUserInfo: IValidateKeyDataV2 = {
    email: input.email,
    isPremium: input.membership_roles.includes("premium"),
    isSupporter: input.membership_roles.includes("supporter"),
    name: input.name,
    profileUrl: input.avatar,
    userId: Number.parseInt(input.sub),
    isLifetime: input.membership_roles.includes("lifetimepremium"),
    isBanned: input.group_id === 5,
    isClosed: input.group_id === 41,
    status: getAccountStatus(input),
    ...input.preferences,
  };

  //log('info', 'transformUserInfoFromApi()', stateUserInfo);

  return stateUserInfo;
}

function userInfoFromJWTToken(input: IJWTAccessToken) {
  return {
    email: "",
    isPremium: input.user.membership_roles.includes("premium"),
    isSupporter: input.user.membership_roles.includes("supporter"),
    name: input.user.username,
    profileUrl: "",
    userId: input.user.id,
  };
}

export function getOAuthTokenFromState(api: IExtensionApi) {
  const state = api.getState();
  const apiKey = state.confidential.account?.["nexus"]?.["APIKey"];
  const oauthCred: IOAuthCredentials =
    state.confidential.account?.["nexus"]?.["OAuthCredentials"];

  //log('info', 'getOAuthTokenFromState()');
  //log('info', 'api key', apiKey !== undefined);
  //log('info', 'oauth cred', oauthCred !== undefined);

  return oauthCred !== undefined ? oauthCred.token : undefined;
}

function getUserInfo(
  api: IExtensionApi,
  nexus: Nexus,
  /*userInfo: IValidateKeyResponse*/
): BluebirdPromise<boolean> {
  log("info", "updateUserInfo()");

  /**
   * This is where we are primarily updating the user info in the state.
   * I've added a check for the oauth token in the state, and if it exists, updates
   * from the nexus api instead of the information that was supplied in
   * oauth token itself as this could be out of date
   */
  //const token = getOAuthTokenFromState(api);

  if (isLoggedIn(api.getState())) {
    // get userinfo from api
    return BluebirdPromise.resolve(nexus.getUserInfo())
      .then((apiUserInfo) => {
        // update state with new info from endpoint
        api.store.dispatch(setUserInfo(transformUserInfoFromApi(apiUserInfo)));
        //log('info', 'getUserInfo() nexus.getUserInfo response', apiUserInfo);
        return true;
      })
      .catch((err) => {
        //log('error', `getUserInfo() nexus.getUserInfo response ${err.message}`, err);
        showError(
          api.store.dispatch,
          "An error occurred refreshing user info",
          err,
          {
            allowReport: false,
          },
        );
        return false;
      });
  } else {
    log("warn", "updateUserInfo() not logged in");
  }

  /*
  return github.fetchConfig('api')
    .then(configObj => {
      const currentVer = getApplication().version;
      if ((currentVer !== '0.0.1')
        && (semver.lt(currentVer, configObj.minversion))) {
        nexus['disable']();
        api.sendNotification({
          type: 'warning',
          title: 'Vortex outdated',
          message: 'Your version of Vortex is quite outdated. Network features disabled.',
          actions: [
            {
              title: 'Check for update', action: () => {
                window.api.updater.checkForUpdates('stable', true);
              },
            },
          ],
        });
      }
    })
    .catch(err => {
      log('warn', 'Failed to fetch api config', { message: err.message });
    })
    .then(() => true);*/
}

function onJWTTokenRefresh(
  api: IExtensionApi,
  credentials: IOAuthCredentials,
  nexus: Nexus,
) {
  log("info", "onJWTTokenRefresh");

  // sets state oauth credentials
  api.store.dispatch(
    setOAuthCredentials(
      credentials.token,
      credentials.refreshToken,
      credentials.fingerprint,
    ),
  );

  // if we've had a token refresh, then we need to update userinfo
  // EDIT: we don't want this as it doesnt' make sense if the refresh is completed by a userInfo check.
  // we will leave thie as an 'oauth credentials only' function. updating the state with updated token
  // and then that will perform updateToken below and make sure both node-neuxs and state are in sync.

  //Promise.resolve(getUserInfo(api, nexus));
}

export function updateToken(
  api: IExtensionApi,
  nexus: Nexus,
  credentials: any,
): BluebirdPromise<boolean> {
  setOauthToken(credentials); // used for reporting, unimportant right now

  log("info", "updateToken()");

  // update the nexus-node object with our credentials.
  // could be from nexus_integration once() or from when the credentials are updated in state

  return BluebirdPromise.resolve(
    nexus.setOAuthCredentials(
      {
        fingerprint: credentials.fingerprint,
        refreshToken: credentials.refreshToken,
        token: credentials.token,
      },
      {
        id: OAUTH_CLIENT_ID,
      },
      (credentials: IOAuthCredentials) =>
        onJWTTokenRefresh(api, credentials, nexus), // callback for when token is refreshed by nexus-node
    ),
  )
    .then(() => getUserInfo(api, nexus)) // update userinfo as we've set some new nexus credentials, either by launch, login or token refresh
    .then(() => true)
    .catch((err) => {
      api.showErrorNotification(
        "Authentication failed, please log in again",
        err,
        {
          allowReport: false,
        },
      );
      api.store.dispatch(setUserInfo(undefined));
      api.events.emit("did-login", err);
      return false;
    });
}

export function updateKey(
  api: IExtensionApi,
  nexus: Nexus,
  key: string,
): BluebirdPromise<boolean> {
  setApiKey(key);
  return (
    BluebirdPromise.resolve(nexus.setKey(key))
      .then(() => true)
      //.then(userInfo => updateUserInfo(api, nexus))
      // don't stop the login just because the github rate limit is exceeded
      .catch(RateLimitExceeded, () => BluebirdPromise.resolve(true))
      .catch(TimeoutError, (err) => {
        api.sendNotification({
          type: "error",
          message: "API Key validation timed out",
          actions: [
            {
              title: "Retry",
              action: (dismiss) => {
                updateKey(api, nexus, key);
                dismiss();
              },
            },
          ],
        });
        api.store.dispatch(setUserInfo(undefined));
        api.events.emit("did-login", err);
        return false;
      })
      .catch(NexusError, (err) => {
        api.sendNotification({
          id: "nexus-login-failed",
          type: "error",
          title: "Failed to log in",
          message: errorFromNexusError(err),
          actions: [
            {
              title: "Try again",
              action: (dismiss) => {
                updateKey(api, nexus, key);
                dismiss();
              },
            },
          ],
        });
        api.store.dispatch(setUserInfo(undefined));
        api.events.emit("did-login", err);
        return false;
      })
      .catch(ProcessCanceled, (err) => {
        log("debug", "login canceled", err.message);
        api.sendNotification({
          id: "nexus-login-failed",
          type: "error",
          title: "Failed to log in",
          message: err.message,
          actions: [
            {
              title: "Try again",
              action: (dismiss) => {
                updateKey(api, nexus, key);
                dismiss();
              },
            },
          ],
        });
        api.store.dispatch(setUserInfo(undefined));
        api.events.emit("did-login", err);
        return false;
      })
      .catch((err) => {
        const t = api.translate;
        api.showErrorNotification(
          err.code === "ESOCKETTIMEDOUT"
            ? "Connection to nexusmods.com timed out, please check your internet connection"
            : "Failed to log in",
          err,
          {
            actions: [
              {
                title: "Retry",
                action: (dismiss) => {
                  updateKey(api, nexus, key);
                  dismiss();
                },
              },
            ],
          },
        );
        api.store.dispatch(setUserInfo(undefined));
        api.events.emit("did-login", err);
        return false;
      })
  );
}

let nexusGamesCache: IGameListEntry[] = [];

let onCacheLoaded: () => void;
const cachePromise = new BluebirdPromise(
  (resolve) => (onCacheLoaded = resolve),
);

function cachePath() {
  return path.join(getVortexPath("temp"), "nexus_gamelist.json");
}

export function retrieveNexusGames(nexus: Nexus) {
  return fs
    .readFileAsync(cachePath(), { encoding: "utf8" })
    .then((cacheData) => {
      nexusGamesCache = JSON.parse(cacheData);
    })
    .catch(() => {
      // ignore missing cache
    })
    .then(() =>
      BluebirdPromise.resolve(jsonRequest<IGameListEntry[]>(GAMES_JSON_URL)),
    )
    .then((gamesList) => {
      nexusGamesCache = gamesList.sort((lhs, rhs) =>
        lhs.name.localeCompare(rhs.name),
      );
      return fs.writeFileAsync(cachePath(), JSON.stringify(gamesList));
    })
    .catch((err) => {
      // maybe network issues, may not be problematic
      log("warn", "failed to fetch list of nexus games", {
        error: err.message,
      });
    })
    .then(() => {
      onCacheLoaded();
    });

  /* could also do this through the API but fetching a static file is more efficient
  nexus.getGames()
    .then(games => {
      nexusGamesCache = games.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
      onCacheLoaded();
    })
    .catch(err => null);
  */
}

export function nexusGames(): IGameListEntry[] {
  return nexusGamesCache;
}

export function nexusGamesProm(): BluebirdPromise<IGameListEntry[]> {
  return cachePromise.then(() => nexusGamesCache);
}
