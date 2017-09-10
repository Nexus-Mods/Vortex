import {IChunk} from './IChunk';

export type ProgressCallback = (received: number, total: number,
                                chunks: IChunk[], filePath?: string) => void;
