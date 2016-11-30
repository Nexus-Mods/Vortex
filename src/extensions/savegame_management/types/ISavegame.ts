export type SavegameState =
  'available';

export interface ISavegame {
  id: string;
  attributes: { [id: string]: any };
}
