
export interface IGameStoreEntry {
  appid: string;
  name: string;
  gamePath: string;
  gameStoreId: string;
  priority?: number;
  lastUpdated?: Date;
  lastUser?: string;
}
