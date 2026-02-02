import { ISavegame } from "./iSavegame";

export interface IStateSavegame {
  saves: { [id: string]: ISavegame };
}
