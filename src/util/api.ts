// rollup module for just the modules we want to be
// part of the api
// (excluding log, which is exported separately to give
//  it a more accessible name)

export * from './message';
export * from './storeHelper';

import { resolveCategoryName,
         resolveCategoryPath } from '../extensions/category_management/util/retrieveCategoryPath';
import { getGame, getGames } from '../extensions/gamemode_management/util/getGame';
import deriveModInstallName from '../extensions/mod_management/modIdManager';
import { getCurrentActivator } from '../extensions/mod_management/util/deploymentMethods';
import renderModName from '../extensions/mod_management/util/modName';
import sortMods, { CycleError } from '../extensions/mod_management/util/sort';
import testModReference from '../extensions/mod_management/util/testModReference';
import { Archive } from './archives';
import copyRecursive from './copyRecursive';
import { DataInvalid, MissingInterpreter, NotFound, NotSupportedError, ProcessCanceled,
         SetupError, UserCanceled } from './CustomErrors';
import Debouncer from './Debouncer';
import delayed from './delayed';
import epicGamesLauncher from './EpicGamesLauncher';
import { terminate } from './errorHandling';
import { extend } from './ExtensionProvider';
import getNormalizeFunc, { Normalize } from './getNormalizeFunc';
import github from './github';
import { getCurrentLanguage } from './i18n';
import LazyComponent from './LazyComponent';
import lazyRequire from './lazyRequire';
import makeReactive from './makeReactive';
import onceCB from './onceCB';
import opn from './opn';
import { getReduxLog } from './reduxLogger';
import ReduxProp from './ReduxProp';
import relativeTime from './relativeTime';
import steam, { GameNotFound, ISteamEntry } from './Steam';
import { bytesToString, copyFileAtomic, fileMD5, isChildPath, objDiff,
         removePersistent, sanitizeCSSId, setdefault } from './util';
import walk from './walk';

import { runElevated, runThreaded } from 'vortex-run';

export {
  Archive,
  bytesToString,
  copyFileAtomic,
  copyRecursive,
  CycleError,
  DataInvalid,
  Debouncer,
  delayed,
  deriveModInstallName as deriveInstallName,
  epicGamesLauncher,
  extend,
  fileMD5,
  GameNotFound,
  getCurrentActivator,
  getCurrentLanguage,
  getGame,
  getGames,
  getNormalizeFunc,
  getReduxLog,
  github,
  isChildPath,
  LazyComponent,
  lazyRequire,
  makeReactive,
  MissingInterpreter,
  Normalize,
  NotFound,
  NotSupportedError,
  objDiff,
  onceCB,
  opn,
  ProcessCanceled,
  ReduxProp,
  relativeTime,
  removePersistent,
  renderModName,
  resolveCategoryName,
  resolveCategoryPath,
  runElevated,
  runThreaded,
  sanitizeCSSId,
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
