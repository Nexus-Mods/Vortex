import { IChunk } from './IChunk';
import { IDownloadOptions } from './IDownload';

// TODO: Remove Bluebird import - using native Promise;

export interface IDownloadJob extends IChunk {
  state: 'init' | 'running' | 'paused' | 'finished';
  workerId?: number;
  restartCount?: number;
  options: IDownloadOptions;
  confirmedReceived: number;
  confirmedOffset: number;
  confirmedSize: number;
  extraCookies: string[];

  dataCB?: (offset: number, data) => Promise<boolean>;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string, chunkable: boolean) => void;
}
