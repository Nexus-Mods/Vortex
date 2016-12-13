import { ICategory } from './ICategory';
import { IGameListEntry } from './IGameListEntry';

export interface IGameInfo extends IGameListEntry {
    categories: ICategory[];
}
