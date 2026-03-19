import type PromiseBB from "bluebird";

export interface IChunk {
  url: () => PromiseBB<string>;
  received: number;
  offset: number;
  size: number;
}
