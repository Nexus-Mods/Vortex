import { IChunk } from './IChunk';

import Promise from 'bluebird';

export interface IDownloadJob extends IChunk {
  state: 'init' | 'running' | 'paused' | 'finished';
  workerId?: number;
  confirmedReceived: number;
  confirmedOffset: number;
  confirmedSize: number;

  dataCB?: (offset: number, data) => Promise<boolean>;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string, chunkable: boolean) => void;
}
