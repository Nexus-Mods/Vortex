import { IAttributeState } from './IAttributeState';
import { IMod } from './IMod';

export interface IStateMods {
  attributeState: { [id: string]: IAttributeState };
  mods: IMod[];
}
