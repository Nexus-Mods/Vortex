import { ISavegame } from "./ISavegame";

export interface IStateSavegame {
  saves: { [id: string]: ISavegame };
}
