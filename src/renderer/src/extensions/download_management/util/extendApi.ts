import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IDownloadsAPIExtension } from "../types/IDownloadsAPIExtension";
import type { IDownloadRemoveOptions } from "../types/IDownloadRemoveOptions";
import type { IDownloadResult } from "../types/IDownloadResult";
import type { RedownloadMode } from "../DownloadManager";
import type { IStartDownloadOptions } from "../types/IStartDownloadOptions";

function extendAPI(api: IExtensionApi): IDownloadsAPIExtension {
  return {
    removeDownload: async (
      downloadId: string,
      options?: IDownloadRemoveOptions,
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        api.events.emit(
          "remove-download",
          downloadId,
          (err: Error) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
          options,
        );
      });
    },
    pauseDownload: async (downloadId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        api.events.emit("pause-download", downloadId, (err: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
    resumeDownload: async (
      downloadId: string,
      options?: IStartDownloadOptions,
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        api.events.emit(
          "resume-download",
          downloadId,
          (err: Error) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
          options,
        );
      });
    },
    startDownload: async (
      urls: string[],
      modInfo: any,
      fileName: string,
      redownload?: RedownloadMode,
      options?: IStartDownloadOptions,
    ): Promise<IDownloadResult> => {
      return new Promise((resolve, reject) => {
        api.events.emit(
          "start-download",
          urls,
          modInfo,
          fileName,
          (err: Error, result: IDownloadResult) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          },
          redownload,
          options,
        );
      });
    },
  };
}

export default extendAPI;
