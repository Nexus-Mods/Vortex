import { IChunk } from './IChunk';

export interface IDownloadResult {
  filePath: string;
  headers: any;
  unfinishedChunks: IChunk[];
  hadErrors: boolean;
  size: number;
  metaInfo: any;
}
