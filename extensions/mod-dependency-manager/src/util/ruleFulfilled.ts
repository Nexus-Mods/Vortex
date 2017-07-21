import {IModLookupInfo} from '../types/IModLookupInfo';

import matchReference from './matchReference';

import {IReference, IRule} from 'modmeta-db';

function findReference(reference: IReference, mods: IModLookupInfo[]): IModLookupInfo {
  return mods.find(mod => matchReference(reference, mod));
}

function ruleFulfilled(enabledMods: IModLookupInfo[], rule: IRule) {
  if (rule.type === 'conflicts') {
    if (findReference(rule.reference, enabledMods) !== undefined) {
      return false;
    } else {
      return true;
    }
  } else if (rule.type === 'requires') {
    if (findReference(rule.reference, enabledMods) === undefined) {
      return false;
    } else {
      return true;
    }
  } else {
    return null;
  }
}

export default ruleFulfilled;
