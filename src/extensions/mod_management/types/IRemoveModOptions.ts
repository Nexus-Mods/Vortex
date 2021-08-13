import { IMod } from '../types/IMod';

export interface IRemoveModOptions {
  // Event emitters should set this to true if the mod is being replaced.
  //  e.g. when reinstalling or updating a mod.
  willBeReplaced?: boolean;

  // Generally this can be resolved from the state itself when listening to
  //  the 'will-remove-mod' and 'remove-mod' events; however, the state will
  //  not contain the removed mod information when listening to
  //  'did-remove-mod' - which is where this becomes handy.
  modData?: IMod;

  // called to signal progress to the caller
  progressCB?: (numRemoved: number, numTotal: number, name: string) => void;
}
