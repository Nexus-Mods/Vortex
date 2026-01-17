/**
 * DependencyDownloader - Handles downloading dependencies for mod installations.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - URL-based download initiation
 * - Version-matching downloads (for fuzzy version requirements)
 * - Dependency download orchestration
 */

import Bluebird from "bluebird";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import { knownGames } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { truthy } from "../../../util/util";
import {
  ProcessCanceled,
  UserCanceled,
  NotFound,
} from "../../../util/CustomErrors";

import {
  AlreadyDownloaded,
  DownloadIsHTML,
} from "../../download_management/DownloadManager";
import { setDownloadModInfo } from "../../download_management/actions/state";
import { convertGameIdReverse } from "../../nexus_integration/util/convertGameId";
import { isFuzzyVersion } from "../util/testModReference";
import type { IModInfoEx } from "../types/IDependency";
import type { IModReference } from "../types/IMod";
import { HTTPError } from "@nexusmods/nexus-api";

/**
 * Download a file from a URL.
 *
 * This initiates a download via the download manager, handling various
 * edge cases like already-downloaded files and HTML redirects.
 *
 * @param api - Extension API
 * @param lookupResult - Lookup result containing download URL and metadata
 * @param wasCanceled - Function to check if operation was canceled
 * @param referenceTag - Optional tag to identify the download
 * @param campaign - Optional campaign tracking parameter
 * @param fileName - Optional override for the file name
 * @returns Promise resolving to the download ID
 */
export function downloadURL(
  api: IExtensionApi,
  lookupResult: IModInfoEx,
  wasCanceled: () => boolean,
  referenceTag?: string,
  campaign?: string,
  fileName?: string,
): Bluebird<string> {
  const call = (input: string | (() => Bluebird<string>)): Bluebird<string> =>
    input !== undefined && typeof input === "function"
      ? input()
      : Bluebird.resolve(input as string);

  let resolvedSource: string;
  let resolvedReferer: string;

  return call(lookupResult.sourceURI)
    .then((res) => (resolvedSource = res))
    .then(() =>
      call(lookupResult.referer).then((res) => (resolvedReferer = res)),
    )
    .then(
      () =>
        new Bluebird<string>((resolve, reject) => {
          if (wasCanceled()) {
            return reject(new UserCanceled(false));
          } else if (!truthy(resolvedSource)) {
            return reject(new UserCanceled(true));
          }
          const parsedUrl = new URL(resolvedSource);
          if (campaign !== undefined && parsedUrl.protocol === "nxm:") {
            parsedUrl.searchParams.set("campaign", campaign);
          }

          if (
            !api.events.emit(
              "start-download",
              [parsedUrl],
              {
                game: convertGameIdReverse(
                  knownGames(api.store.getState()),
                  lookupResult.domainName,
                ),
                source: lookupResult.source,
                name: lookupResult.logicalFileName,
                referer: resolvedReferer,
                referenceTag,
                meta: lookupResult,
              },
              fileName,
              async (error, id) => {
                if (error === null) {
                  return resolve(id);
                } else if (error instanceof AlreadyDownloaded) {
                  return resolve(error.downloadId);
                } else if (error instanceof DownloadIsHTML) {
                  // If this is a google drive link and the file exceeds the
                  // virus testing limit, Google will return an HTML page asking
                  // the user for consent to download the file. Let's try this using
                  // the browser extension.
                  const instructions =
                    `You are trying to download "${lookupResult.fileName}" from "${resolvedSource}".\n` +
                    "Depending on the portal, you may be re-directed several times.";
                  const result: string[] = await api.emitAndAwait(
                    "browse-for-download",
                    resolvedSource,
                    instructions,
                  );
                  if (result.length > 0) {
                    const newLookupRes = {
                      ...lookupResult,
                      sourceURI: result[0],
                    };
                    const id = await downloadURL(
                      api,
                      newLookupRes,
                      wasCanceled,
                      referenceTag,
                      campaign,
                      fileName,
                    );
                    return resolve(id);
                  } else {
                    return reject(new UserCanceled());
                  }
                } else {
                  return reject(error);
                }
              },
              "never",
              { allowInstall: false, allowOpenHTML: false },
            )
          ) {
            return reject(new Error("download manager not installed?"));
          }
        }),
    );
}

/**
 * Download a file matching a version pattern.
 *
 * This is used for fuzzy version requirements where we need to find
 * an appropriate version update rather than an exact file.
 *
 * @param api - Extension API
 * @param lookupResult - Lookup result containing mod information
 * @param pattern - Version pattern to match
 * @param referenceTag - Tag to identify the download
 * @param wasCanceled - Function to check if operation was canceled
 * @param campaign - Optional campaign tracking parameter
 * @param fileName - Optional override for the file name
 * @returns Promise resolving to the download ID
 */
export function downloadMatching(
  api: IExtensionApi,
  lookupResult: IModInfoEx,
  pattern: string,
  referenceTag: string,
  wasCanceled: () => boolean,
  campaign: string,
  fileName?: string,
): Bluebird<string> {
  const modId: string = getSafe(lookupResult, ["details", "modId"], undefined);
  const fileId: string = getSafe(
    lookupResult,
    ["details", "fileId"],
    undefined,
  );
  if (modId === undefined && fileId === undefined) {
    return downloadURL(api, lookupResult, wasCanceled, referenceTag, fileName);
  }

  const gameId = convertGameIdReverse(
    knownGames(api.getState()),
    lookupResult.domainName || lookupResult.gameId,
  );

  return api
    .emitAndAwait(
      "start-download-update",
      lookupResult.source,
      gameId,
      modId,
      fileId,
      pattern,
      campaign,
      referenceTag,
    )
    .then((results: Array<{ error: Error; dlId: string }>) => {
      if (results === undefined || results.length === 0) {
        return Bluebird.reject(
          new NotFound(`source not supported "${lookupResult.source}"`),
        );
      } else {
        if (!truthy(results[0])) {
          return Bluebird.reject(
            new ProcessCanceled("Download failed", { alreadyReported: true }),
          );
        } else {
          const successResult = results.find((iter) => iter.error === null);
          if (successResult === undefined) {
            return Bluebird.reject(results[0].error);
          } else {
            api.store.dispatch(
              setDownloadModInfo(results[0].dlId, "referenceTag", referenceTag),
            );
            return Bluebird.resolve(results[0].dlId);
          }
        }
      }
    });
}

/**
 * Download a dependency asynchronously.
 *
 * This orchestrates the download process, handling:
 * - Fuzzy version matching (+prefer versions, archived mods)
 * - Exact version downloads
 * - Fallback between matching and direct URL downloads
 *
 * @param api - Extension API
 * @param requirement - The mod reference/requirement to download
 * @param lookupResult - Lookup result with download information
 * @param wasCanceled - Function to check if operation was canceled
 * @param fileName - Optional override for the file name
 * @returns Promise resolving to the download ID
 */
export function downloadDependencyAsync(
  api: IExtensionApi,
  requirement: IModReference,
  lookupResult: IModInfoEx,
  wasCanceled: () => boolean,
  fileName: string,
): Bluebird<string> {
  const referenceTag = requirement["tag"];
  const { campaign } = requirement["repo"] ?? {};

  if (
    requirement.versionMatch !== undefined &&
    (!requirement.versionMatch.endsWith("+prefer") || lookupResult.archived) &&
    isFuzzyVersion(requirement.versionMatch)
  ) {
    // Seems to be a fuzzy matcher so we may have to look for an update
    return downloadMatching(
      api,
      lookupResult,
      requirement.versionMatch,
      referenceTag,
      wasCanceled,
      campaign,
      fileName,
    )
      .catch((err) => {
        if (err instanceof HTTPError) {
          // Assuming the API failed because the mod had been archived,
          // can still download the exact file specified by the curator
          return undefined;
        } else {
          return Bluebird.reject(err);
        }
      })
      .then((res) =>
        res === undefined
          ? downloadURL(
              api,
              lookupResult,
              wasCanceled,
              referenceTag,
              campaign,
              fileName,
            )
          : res,
      );
  } else {
    return downloadURL(
      api,
      lookupResult,
      wasCanceled,
      referenceTag,
      campaign,
      fileName,
    ).catch((err) => {
      if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
        return Bluebird.reject(err);
      }
      // With +prefer versions, if the exact version isn't available, an update is acceptable
      if (requirement.versionMatch?.endsWith?.("+prefer")) {
        return downloadMatching(
          api,
          lookupResult,
          requirement.versionMatch,
          referenceTag,
          wasCanceled,
          campaign,
          fileName,
        );
      } else {
        return Bluebird.reject(err);
      }
    });
  }
}

/**
 * DependencyDownloader class - provides dependency download utilities.
 *
 * This class wraps the standalone functions for cases where a class-based
 * interface is preferred.
 */
export class DependencyDownloader {
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  /**
   * Download a file from a URL.
   */
  public downloadURL(
    lookupResult: IModInfoEx,
    wasCanceled: () => boolean,
    referenceTag?: string,
    campaign?: string,
    fileName?: string,
  ): Bluebird<string> {
    return downloadURL(
      this.mApi,
      lookupResult,
      wasCanceled,
      referenceTag,
      campaign,
      fileName,
    );
  }

  /**
   * Download a file matching a version pattern.
   */
  public downloadMatching(
    lookupResult: IModInfoEx,
    pattern: string,
    referenceTag: string,
    wasCanceled: () => boolean,
    campaign: string,
    fileName?: string,
  ): Bluebird<string> {
    return downloadMatching(
      this.mApi,
      lookupResult,
      pattern,
      referenceTag,
      wasCanceled,
      campaign,
      fileName,
    );
  }

  /**
   * Download a dependency asynchronously.
   */
  public downloadDependencyAsync(
    requirement: IModReference,
    lookupResult: IModInfoEx,
    wasCanceled: () => boolean,
    fileName: string,
  ): Bluebird<string> {
    return downloadDependencyAsync(
      this.mApi,
      requirement,
      lookupResult,
      wasCanceled,
      fileName,
    );
  }
}
