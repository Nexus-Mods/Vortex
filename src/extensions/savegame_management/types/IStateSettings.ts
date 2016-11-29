import { IAttributeState } from './IAttributeState';

export interface IStateSavegameSettings {
  savegamelistState: { [id: string]: IAttributeState };
}
