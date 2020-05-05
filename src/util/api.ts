// rollup module for just the modules we want to be
// part of the api
// (excluding log, which is exported separately to give
//  it a more accessible name)

export * from './message';
export * from './storeHelper';

import { installIconSet } from '../controls/Icon';
import { resolveCategoryName,
         resolveCategoryPath } from '../extensions/category_management/util/retrieveCategoryPath';
import { readExtensibleDir } from '../extensions/extension_manager/util';
import { getGame, getGames } from '../extensions/gamemode_management/util/getGame';
import deriveModInstallName from '../extensions/mod_management/modIdManager';
import { getManifest } from '../extensions/mod_management/util/activationStore';
import { getActivator,
         getCurrentActivator } from '../extensions/mod_management/util/deploymentMethods';
import renderModName from '../extensions/mod_management/util/modName';
import sortMods, { CycleError } from '../extensions/mod_management/util/sort';
import testModReference from '../extensions/mod_management/util/testModReference';
import GameStoreHelper from '../util/GameStoreHelper';
import { Archive } from './archives';
import copyRecursive from './copyRecursive';
import { ArgumentInvalid, DataInvalid, MissingInterpreter, NotFound, NotSupportedError,
         ProcessCanceled, SetupError, UserCanceled } from './CustomErrors';
import Debouncer from './Debouncer';
import epicGamesLauncher from './EpicGamesLauncher';
import { getVisibleWindow, terminate } from './errorHandling';
import { extend } from './ExtensionProvider';
import { copyFileAtomic, fileMD5 } from './fsAtomic';
import getNormalizeFunc, { makeNormalizingDict, Normalize } from './getNormalizeFunc';
import {getVortexPath, setVortexPath} from './getVortexPath';
import github from './github';
import { getCurrentLanguage, TFunction } from './i18n';
import LazyComponent from './LazyComponent';
import lazyRequire from './lazyRequire';
import makeReactive from './makeReactive';
import onceCB from './onceCB';
import opn from './opn';
import { getReduxLog } from './reduxLogger';
import ReduxProp from './ReduxProp';
import relativeTime, { userFriendlyTime } from './relativeTime';
import StarterInfo from './StarterInfo';
import steam, { GameNotFound, ISteamEntry } from './Steam';
import { bytesToString, deBOM, isChildPath, makeQueue, objDiff,
         pad, sanitizeCSSId, setdefault } from './util';
import walk from './walk';

import SevenZip = require('node-7z');
import { runElevated, runThreaded } from 'vortex-run';

export * from './network';

export {
  Archive,
  ArgumentInvalid,
  bytesToString,
  copyFileAtomic,
  copyRecursive,
  CycleError,
  DataInvalid,
  Debouncer,
  deBOM,
  deriveModInstallName as deriveInstallName,
  epicGamesLauncher,
  extend,
  fileMD5,
  GameNotFound,
  GameStoreHelper,
  getActivator,
  getCurrentActivator,
  getCurrentLanguage,
  getGame,
  getGames,
  getManifest,
  getNormalizeFunc,
  getReduxLog,
  getVisibleWindow,
  getVortexPath,
  setVortexPath,
  github,
  installIconSet,
  isChildPath,
  LazyComponent,
  lazyRequire,
  makeNormalizingDict,
  makeQueue,
  makeReactive,
  MissingInterpreter,
  Normalize,
  NotFound,
  NotSupportedError,
  objDiff,
  onceCB,
  opn,
  pad,
  ProcessCanceled,
  ReduxProp,
  readExtensibleDir,
  relativeTime,
  renderModName,
  resolveCategoryName,
  resolveCategoryPath,
  runElevated,
  runThreaded,
  sanitizeCSSId,
  setdefault,
  SetupError,
  SevenZip,
  sortMods,
  StarterInfo,
  steam,
  ISteamEntry,
  terminate,
  testModReference,
  UserCanceled,
  userFriendlyTime,
  walk,
};

// getText functions are rolled up into one function
export type TextGroup = 'mod';
import getTextModManagement from '../extensions/mod_management/texts';

export function getText(group: TextGroup, textId: string, t: TFunction) {
  if (group === 'mod') {
    return getTextModManagement(textId, t);
  }
  throw new Error('invalid text group: ' + group);
}
