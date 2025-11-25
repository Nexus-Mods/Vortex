import { IDownloadRemoveOptions } from '../types/IDownloadRemoveOptions';
import { IDownloadResult } from './IDownloadResult';
import { IStartDownloadOptions } from '../types/IStartDownloadOptions';
import { RedownloadMode } from '../DownloadManager';

export interface IDownloadsAPIExtension {
  removeDownload?: (downloadId: string, options?: IDownloadRemoveOptions) => Promise<void>;

  pauseDownload?: (downloadId: string) => Promise<void>;

  resumeDownload?: (downloadId: string, options?: IStartDownloadOptions) => Promise<void>;

  startDownload?: (
    urls: string[],
    modInfo: any,
    fileName: string,
    redownload?: RedownloadMode,
    options?: IStartDownloadOptions
  ) => Promise<IDownloadResult>;
}