import Bluebird from 'bluebird';
import { IDownloadJob } from './IDownloadJob';
import { IDownloadOptions } from './IDownload';
import FileAssembler from '../FileAssembler';
import { IResolvedURLs } from './ProtocolHandlers';
import { IDownloadResult } from './IDownloadResult';
import { ProgressCallback } from './ProgressCallback';
export interface IRunningDownload {
  id: string;
  fd?: number;
  error: boolean;
  urls: string[];
  resolvedUrls: () => Bluebird<IResolvedURLs>;
  origName: string;
  tempName: string;
  finalName?: Bluebird<string>;
  lastProgressSent: number;
  received: number;
  started: Date;
  options: IDownloadOptions;
  size?: number;
  headers?: any;
  assembler?: FileAssembler;
  assemblerProm?: Bluebird<FileAssembler>;
  chunks: IDownloadJob[];
  chunkable: boolean;
  Bluebirds: Array<Bluebird<any>>;
  progressCB?: ProgressCallback;
  finishCB: (res: IDownloadResult) => void;
  failedCB: (err) => void;
}