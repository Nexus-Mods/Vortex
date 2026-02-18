export interface IGameStoreEntry {
  appid: string;
  name: string;
  gamePath: string;
  gameStoreId: string | undefined;
  priority?: number;
  lastUpdated?: Date;
  lastUser?: string;
}
