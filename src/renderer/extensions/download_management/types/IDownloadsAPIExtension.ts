import type { IDownloadRemoveOptions } from "./IDownloadRemoveOptions";
import type { IDownloadResult } from "./IDownloadResult";
import type { IStartDownloadOptions } from "./IStartDownloadOptions";
import type { RedownloadMode } from "../DownloadManager";

export interface IDownloadsAPIExtension {
  removeDownload?: (
    downloadId: string,
    options?: IDownloadRemoveOptions,
  ) => Promise<void>;

  pauseDownload?: (downloadId: string) => Promise<void>;

  resumeDownload?: (
    downloadId: string,
    options?: IStartDownloadOptions,
  ) => Promise<void>;

  startDownload?: (
    urls: string[],
    modInfo: any,
    fileName: string,
    redownload?: RedownloadMode,
    options?: IStartDownloadOptions,
  ) => Promise<IDownloadResult>;
}
