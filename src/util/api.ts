// rollup module for just the modules we want to be
// part of the api
// (excluding log, which is exported separately to give
//  it a more accessible name)

export * from './message';
export * from './storeHelper';

import { getGames } from '../extensions/gamemode_management/index';
import deriveModInstallName from '../extensions/mod_management/modIdManager';
import renderModName from '../extensions/mod_management/util/modName';
import sortMods from '../extensions/mod_management/util/sort';
import { Archive } from './archives';
import AsyncComponent from './AsyncComponent';
import copyRecursive from './copyRecursive';
import { NotSupportedError, UserCanceled } from './CustomErrors';
import Debouncer from './Debouncer';
import runElevated from './elevated';
import { terminate } from './errorHandling';
import { extend } from './ExtensionProvider';
import getNormalizeFunc, { Normalize } from './getNormalizeFunc';
import { getCurrentLanguage } from './i18n';
import LazyComponent from './LazyComponent';
import lazyRequire from './lazyRequire';
import makeReactive from './makeReactive';
import ReduxProp from './ReduxProp';
import relativeTime from './relativeTime';
import Steam, { ISteamEntry } from './Steam';
import { bytesToString, isNullOrWhitespace, setdefault } from './util';
import walk from './walk';

export {
  Archive,
  AsyncComponent,
  bytesToString,
  copyRecursive,
  Debouncer,
  deriveModInstallName as deriveInstallName,
  extend,
  getCurrentLanguage,
  getGames,
  getNormalizeFunc,
  isNullOrWhitespace,
  LazyComponent,
  lazyRequire,
  makeReactive,
  Normalize,
  NotSupportedError,
  ReduxProp,
  relativeTime,
  renderModName,
  runElevated,
  setdefault,
  sortMods,
  Steam,
  ISteamEntry,
  terminate,
  UserCanceled,
  walk,
};

// getText functions are rolled up into one function
export type TextGroup = 'mod';
import getTextModManagement from '../extensions/mod_management/texts';

import * as I18next from 'i18next';

export function getText(group: TextGroup, textId: string, t: I18next.TranslationFunction) {
  if (group === 'mod') {
    return getTextModManagement(textId, t);
  }
  throw new Error('invalid text group: ' + group);
}
