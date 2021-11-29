import { IMod } from '../types/IMod';

export interface IRemoveModOptions {
  // Event emitters should set this to true if the mod is being replaced.
  //  e.g. when reinstalling or updating a mod.
  willBeReplaced?: boolean;

  // set to indicate that the mod wasn't fully installed and thus events that are
  // expected when removing an installed mod should not trigger.
  // what "not fully installed" means is up to the emitter, e.g. when canceling a collection
  // installation we use this flag even though the collection is installed but its dependencies
  // aren't
  incomplete?: boolean;

  // Generally this can be resolved from the state itself when listening to
  //  the 'will-remove-mod' and 'remove-mod' events; however, the state will
  //  not contain the removed mod information when listening to
  //  'did-remove-mod' - which is where this becomes handy.
  modData?: IMod;

  // called to signal progress to the caller
  progressCB?: (numRemoved: number, numTotal: number, name: string) => void;
}
