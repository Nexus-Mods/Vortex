// rollup module for just the modules we want to be
// part of the api
// (excluding log, which is exported separately to give
//  it a more accessible name)

export * from './message';
export * from './storeHelper';

import { resolveCategoryName, resolveCategoryPath } from '../extensions/category_management';
import { getGame, getGames } from '../extensions/gamemode_management';
import deriveModInstallName from '../extensions/mod_management/modIdManager';
import renderModName from '../extensions/mod_management/util/modName';
import resolvePath from '../extensions/mod_management/util/resolvePath';
import sortMods from '../extensions/mod_management/util/sort';
import testModReference from '../extensions/mod_management/util/testModReference';
import { Archive } from './archives';
import AsyncComponent from './AsyncComponent';
import copyRecursive from './copyRecursive';
import { DataInvalid, MissingInterpreter, NotSupportedError, ProcessCanceled,
         SetupError, UserCanceled } from './CustomErrors';
import Debouncer from './Debouncer';
import delayed from './delayed';
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
import steam, { ISteamEntry } from './Steam';
import runThreaded from './thread';
import { bytesToString, copyFileAtomic, isNullOrWhitespace, objDiff,
         removePersistent, setdefault } from './util';
import walk from './walk';

export {
  Archive,
  AsyncComponent,
  bytesToString,
  copyFileAtomic,
  copyRecursive,
  DataInvalid,
  Debouncer,
  delayed,
  deriveModInstallName as deriveInstallName,
  extend,
  getCurrentLanguage,
  getGame,
  getGames,
  getNormalizeFunc,
  isNullOrWhitespace,
  LazyComponent,
  lazyRequire,
  makeReactive,
  MissingInterpreter,
  Normalize,
  NotSupportedError,
  objDiff,
  ProcessCanceled,
  ReduxProp,
  relativeTime,
  removePersistent,
  renderModName,
  resolveCategoryName,
  resolveCategoryPath,
  resolvePath,
  runElevated,
  runThreaded,
  setdefault,
  SetupError,
  sortMods,
  steam,
  ISteamEntry,
  terminate,
  testModReference,
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
