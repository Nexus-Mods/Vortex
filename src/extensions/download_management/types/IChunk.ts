// TODO: Remove Bluebird import - using native Promise;

export interface IChunk {
  url: () => Promise<string>;
  received: number;
  offset: number;
  size: number;
}
