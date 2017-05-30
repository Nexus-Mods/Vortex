// rollup module for just the modules we want to be
// part of the api
// (excluding log, which is exported separately to give
//  it a more accessible name)

export * from './message';
export * from './storeHelper';

import { Archive } from './archives';
import AsyncComponent from './AsyncComponent';
import { NotSupportedError, UserCanceled } from './CustomErrors';
import Debouncer from './Debouncer';
import runElevated from './elevated';
import { terminate } from './errorHandling';
import { extend } from './ExtensionProvider';
import getNormalizeFunc from './getNormalizeFunc';
import { getCurrentLanguage } from './i18n';
import LazyComponent from './LazyComponent';
import lazyRequire from './lazyRequire';
import ReduxProp from './ReduxProp';
import relativeTime from './relativeTime';
import Steam, { ISteamEntry } from './Steam';
import { setdefault } from './util';
import walk from './walk';

export {
  Archive,
  AsyncComponent,
  Debouncer,
  extend,
  getCurrentLanguage,
  getNormalizeFunc,
  LazyComponent,
  lazyRequire,
  NotSupportedError,
  ReduxProp,
  relativeTime,
  runElevated,
  setdefault,
  Steam,
  ISteamEntry,
  terminate,
  UserCanceled,
  walk,
};

// getText functions are rolled up into one function
export type TextGroup = 'mod';
import getTextModManagement from '../extensions/mod_management/texts';

export function getText(group: TextGroup, textId: string, t: I18next.TranslationFunction) {
  if (group === 'mod') {
    return getTextModManagement(textId, t);
  }
  throw new Error('invalid text group: ' + group);
}
