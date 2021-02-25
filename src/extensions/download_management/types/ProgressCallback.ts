import {IChunk} from './IChunk';

export type ProgressCallback = (received: number, total: number,
                                chunks: IChunk[], chunkable: boolean,
                                urls: string[], filePath?: string) => void;
