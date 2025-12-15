import Bluebird from "bluebird";
import { IModInfoEx } from "../types/IDependency";
import { IExtensionApi } from "../../../types/IExtensionContext";
import {
  convertGameIdReverse,
  getSafe,
  NotFound,
  ProcessCanceled,
  UserCanceled,
} from "../../../util/api";
import { truthy } from "../../../util/util";
import { knownGames } from "../../gamemode_management/selectors";
import {
  AlreadyDownloaded,
  DownloadIsHTML,
} from "../../download_management/DownloadManager";
import { setDownloadModInfo } from "vortex-api/lib/actions";

export class InstallManagerModuleDownloads {
  public downloadURL(
    api: IExtensionApi,
    lookupResult: IModInfoEx,
    wasCanceled: () => boolean,
    referenceTag?: string,
    campaign?: string,
    fileName?: string,
  ): Bluebird<string> {
    const call = (
      input: string | (() => Bluebird<string>),
    ): Bluebird<string> =>
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
                    //  virus testing limit, Google will return an HTML page asking
                    //  the user for consent to download the file. Lets try this using
                    //  the browser extension.
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
                      const id = await this.downloadURL(
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

  public downloadMatching(
    api: IExtensionApi,
    lookupResult: IModInfoEx,
    pattern: string,
    referenceTag: string,
    wasCanceled: () => boolean,
    campaign: string,
    fileName?: string,
  ): Bluebird<string> {
    const modId: string = getSafe(
      lookupResult,
      ["details", "modId"],
      undefined,
    );
    const fileId: string = getSafe(
      lookupResult,
      ["details", "fileId"],
      undefined,
    );
    if (modId === undefined && fileId === undefined) {
      return this.downloadURL(
        api,
        lookupResult,
        wasCanceled,
        referenceTag,
        fileName,
      );
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
                setDownloadModInfo(
                  results[0].dlId,
                  "referenceTag",
                  referenceTag,
                ),
              );
              return Bluebird.resolve(results[0].dlId);
            }
          }
        }
      });
  }
}
