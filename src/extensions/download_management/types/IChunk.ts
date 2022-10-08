import Bluebird from 'bluebird';

export interface IChunk {
  url: () => Bluebird<string>;
  received: number;
  offset: number;
  size: number;
}
