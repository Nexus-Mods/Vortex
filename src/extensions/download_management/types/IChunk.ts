import Promise from 'bluebird';

export interface IChunk {
  url: () => Promise<string>;
  received: number;
  offset: number;
  size: number;
}
