import { IChunk } from './IChunk';

import * as Promise from 'bluebird';

export interface IDownloadJob extends IChunk {
  state: 'init' | 'running' | 'paused' | 'finished';
  workerId?: number;
  dataCB?: (offset: number, data) => Promise<boolean>;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string, chunkable: boolean) => void;
}
