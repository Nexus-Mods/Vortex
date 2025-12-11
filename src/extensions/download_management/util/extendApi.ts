import { IExtensionApi } from "../../../types/IExtensionContext";
import { IDownloadsAPIExtension } from "../types/IDownloadsAPIExtension";
import { IDownloadRemoveOptions } from "../types/IDownloadRemoveOptions";
import { IDownloadResult } from "../types/IDownloadResult";
import { RedownloadMode } from "../DownloadManager";
import { IStartDownloadOptions } from "../types/IStartDownloadOptions";

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
