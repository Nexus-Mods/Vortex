export interface IDownloadJob {
  url: string;
  offset: number;
  state: 'init' | 'running' | 'finished';
  workerId?: number;
  size?: number;
  dataCB?: (offset: number, data) => void;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string) => void;
}
