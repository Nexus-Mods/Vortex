import { IChunk } from './IChunk';
import { IDownloadOptions } from './IDownload';

import Bluebird from 'bluebird';

export interface IDownloadJob extends IChunk {
  state: 'init' | 'running' | 'paused' | 'finished';
  workerId?: number;
  options: IDownloadOptions;
  confirmedReceived: number;
  confirmedOffset: number;
  confirmedSize: number;
  extraCookies: string[];

  dataCB?: (offset: number, data) => Bluebird<boolean>;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string, chunkable: boolean) => void;
}
