export type SavegameState =
  'available';

export interface ISavegame {
  id: string;
  savegameBind: any;
  attributes: { [id: string]: any };
}
