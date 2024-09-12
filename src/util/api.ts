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
import { getModType } from '../extensions/gamemode_management/util/modTypeExtensions';
import getDriveList from '../extensions/gamemode_management/util/getDriveList';
import deriveModInstallName from '../extensions/mod_management/modIdManager';
import { getManifest } from '../extensions/mod_management/util/activationStore';
import { findDownloadByRef, findModByRef, lookupFromDownload } from '../extensions/mod_management/util/dependencies';
import { getActivator,
         getCurrentActivator } from '../extensions/mod_management/util/deploymentMethods';
import renderModName, { renderModReference } from '../extensions/mod_management/util/modName';
import { makeModReference } from '../extensions/mod_management/util/modReference';
import { getModSource, getModSources } from '../extensions/mod_management/util/modSource';
import { removeMods } from '../extensions/mod_management/util/removeMods';
import sortMods, { CycleError } from '../extensions/mod_management/util/sort';
import testModReference, { coerceToSemver } from '../extensions/mod_management/util/testModReference';
import { convertGameIdReverse, nexusGameId } from '../extensions/nexus_integration/util/convertGameId';
import GameStoreHelper from '../util/GameStoreHelper';
import { getApplication } from './application';
import { Archive } from './archives';
import bbcodeToReact, { bbcodeToHTML, preProcess as bbcodePreProcess } from './bbcode';
import calculateFolderSize from './calculateFolderSize';
import { checksum, fileMD5 } from './checksum';
import ConcurrencyLimiter from './ConcurrencyLimiter';
import copyRecursive from './copyRecursive';
import { ArgumentInvalid, DataInvalid, MissingInterpreter, NotFound, NotSupportedError,
         ProcessCanceled, SetupError, UserCanceled } from './CustomErrors';
import Debouncer from './Debouncer';
import makeRemoteCall from './electronRemote';
import epicGamesLauncher from './EpicGamesLauncher';
import { getVisibleWindow, terminate, withContext as withErrorContext } from './errorHandling';
import extractExeIcon from './exeIcon';
import { extend } from './ExtensionProvider';
import { copyFileAtomic, writeFileAtomic } from './fsAtomic';
import getNormalizeFunc, { makeNormalizingDict, Normalize } from './getNormalizeFunc';
import getVortexPath from './getVortexPath';
import github from './github';
import { getCurrentLanguage, TFunction } from './i18n';
import LazyComponent from './LazyComponent';
import lazyRequire from './lazyRequire';
import local from './local';
import makeReactive from './makeReactive';
import onceCB from './onceCB';
import opn from './opn';
import { getReduxLog } from './reduxLogger';
import ReduxProp from './ReduxProp';
import relativeTime, { userFriendlyTime } from './relativeTime';
import StarterInfo from './StarterInfo';
import steam, { GameNotFound, ISteamEntry } from './Steam';
import { batchDispatch, bytesToString, deBOM, delay, isChildPath, isFilenameValid, isPathValid,
         makeQueue, makeUnique, makeUniqueByKey, nexusModsURL, objDiff, pad, sanitizeCSSId,
         sanitizeFilename, semverCoerce, setdefault, toBlue, toPromise, unique,
         makeOverlayableDictionary } from './util';
import { Campaign, Section, Source, Overlayable } from './util';
import deepMerge from './deepMerge';
import walk from './walk';

import SevenZip = require('node-7z');
import { runElevated, runThreaded } from 'vortex-run';

export * from './network';

export {
  Archive,
  ArgumentInvalid,
  batchDispatch,
  bbcodePreProcess,
  bbcodeToHTML,
  bbcodeToReact,
  bytesToString,
  calculateFolderSize,
  Campaign,
  checksum,
  convertGameIdReverse,
  copyFileAtomic,
  copyRecursive,
  ConcurrencyLimiter,
  CycleError,
  DataInvalid,
  Debouncer,
  deBOM,
  deepMerge,
  delay,
  deriveModInstallName as deriveInstallName,
  epicGamesLauncher,
  extend,
  extractExeIcon,
  fileMD5,
  findDownloadByRef,
  findModByRef,
  GameNotFound,
  GameStoreHelper,
  getActivator,
  getApplication,
  getCurrentActivator,
  getCurrentLanguage,
  getDriveList,
  getGame,
  getGames,
  getManifest,
  getModSource,
  getModSources,
  getModType,
  getNormalizeFunc,
  getReduxLog,
  getVisibleWindow,
  getVortexPath,
  github,
  installIconSet,
  isChildPath,
  isFilenameValid,
  isPathValid,
  LazyComponent,
  lazyRequire,
  local,
  lookupFromDownload,
  makeModReference,
  coerceToSemver,
  makeNormalizingDict,
  makeOverlayableDictionary,
  makeQueue,
  makeReactive,
  makeRemoteCall,
  makeUnique,
  makeUniqueByKey,
  MissingInterpreter,
  nexusGameId,
  nexusModsURL,
  Normalize,
  NotFound,
  NotSupportedError,
  objDiff,
  onceCB,
  opn,
  Overlayable,
  pad,
  ProcessCanceled,
  ReduxProp,
  readExtensibleDir,
  relativeTime,
  removeMods,
  renderModName,
  renderModReference,
  resolveCategoryName,
  resolveCategoryPath,
  runElevated,
  runThreaded,
  sanitizeCSSId,
  sanitizeFilename,
  Section,
  semverCoerce,
  setdefault,
  SetupError,
  SevenZip,
  sortMods,
  Source,
  StarterInfo,
  steam,
  ISteamEntry,
  terminate,
  testModReference,
  toBlue,
  toPromise,
  unique,
  UserCanceled,
  userFriendlyTime,
  walk,
  withErrorContext,
  writeFileAtomic,
};

// getText functions are rolled up into one function
export type TextGroup = 'mod' | 'profile';
import getTextModManagement from '../extensions/mod_management/texts';
import getTextProfileManagement from '../extensions/profile_management/texts';

export function getText(group: TextGroup, textId: string, t: TFunction) {
  if (group === 'mod') {
    return getTextModManagement(textId, t);
  } else if (group === 'profile') {
    return getTextProfileManagement(textId, t);
  }
  throw new Error('invalid text group: ' + group);
}
