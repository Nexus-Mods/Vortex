import {IChunk} from './IChunk';

export type ProgressCallback = (received: number, total: number,
                                chunks: IChunk[], urls: string[], filePath?: string) => void;
