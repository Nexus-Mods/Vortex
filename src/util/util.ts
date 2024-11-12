/* eslint-disable */
import { NEXUS_DOMAIN, NEXUS_FLAMEWORK_SUBDOMAIN, NEXUS_NEXT_SUBDOMAIN, NEXUS_PROTOCOL, NEXUS_USERS_SUBDOMAIN } from '../extensions/nexus_integration/constants';

import { TimeoutError } from './CustomErrors';
import { Normalize } from './getNormalizeFunc';
import getVortexPath from './getVortexPath';
import { log } from './log';

import Bluebird from 'bluebird';
import { spawn } from 'child_process';
import * as _ from 'lodash';
import * as path from 'path';
import * as process from 'process';
import * as Redux from 'redux';
import { batch } from 'redux-act';
import * as semver from 'semver';
import * as tmp from 'tmp';
import * as url from 'url';

/**
 * count the elements in an array for which the predicate matches
 *
 * @export
 * @template T
 * @param {T[]} container
 * @param {(value: T) => boolean} predicate
 * @returns {number}
 */
export function countIf<T>(container: T[], predicate: (value: T) => boolean): number {
  return container.reduce((count: number, value: T): number => {
    return count + (predicate(value) ? 1 : 0);
  }, 0);
}

/**
 * calculate the sum of the elements of an array
 *
 * @export
 * @param {number[]} container
 * @returns {number}
 */
export function sum(container: number[]): number {
  return container.reduce((total: number, value: number): number =>
    total + value, 0);
}

/**
 * like the python setdefault function:
 * returns the attribute "key" from "obj". If that attribute doesn't exist
 * on obj, it will be set to the default value and that is returned.
 */
export function setdefault<T, K extends keyof T>(obj: T, key: K, def: T[K]): T[K] {
  if (!obj.hasOwnProperty(key)) {
    obj[key] = def;
  }
  return obj[key];
}

/**
 * An ellipsis ("this text is too lo...") function. Usually these
 * functions clip the text at the end but often (i.e. when
 * clipping file paths) the end of the text is the most interesting part,
 * so this function clips the middle part of the input.
 * @param input the input text
 * @param maxLength the maximum number of characters (including ...)
 * @return the shortened text
 */
export function midClip(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }

  const half = maxLength / 2;
  return input.substr(0, half - 2)
    + '...'
    + input.substr(input.length - (half - 1));
}

/**
 * test if a string is null, undefined or consists only of whitespaces
 * @param {string} check the string to check
 */
export function isNullOrWhitespace(check: string): boolean {
    return (!check || (check.trim().length === 0));
}

/**
 * return whether the specified value is "truthy" (not one of
 * these: undefined, null, 0, -0, NaN "")
 *
 * Obviously one could just do "if (val)" but js noobs
 * may not be aware what values that accepts exactly and whether that was
 * intentional. This is more explicit.
 */
export function truthy(val: any): boolean {
  return !!val;
}

/**
 * return the delta between two objects
 * @param lhs the left, "before", object
 * @param rhs the right, "after", object
 * @param skip properties to skip in the diff, string array
 */
export function objDiff(lhs: any, rhs: any, skip?: string[]): any {
  const res = {};

  if ((typeof(lhs) === 'object') && (typeof(rhs) === 'object')) {
    Object.keys(lhs || {}).forEach(key => {
      if ((skip !== undefined) && Array.isArray(skip) && (skip.indexOf(key) !== -1)) {
        return null;
      }
      if (!Object.prototype.hasOwnProperty.call(rhs, key)
          && Object.prototype.hasOwnProperty.call(lhs, key)) {
        res['-' + key] = lhs[key];
      } else {
        const sub = objDiff(lhs?.[key] ?? {}, rhs?.[key] ?? {});
        if (sub === null || sub === undefined) {
          res['-' + key] = lhs?.[key] ?? null;
          res['+' + key] = rhs?.[key] ?? null;
        } else if (Object.keys(sub).length !== 0) {
          res[key] = sub;
        }
      }
    });
    Object.keys(rhs || {}).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(lhs, key)
          && Object.prototype.hasOwnProperty.call(rhs, key)) {
        res['+' + key] = rhs[key];
      }
    });
  } else if (lhs !== rhs) {
    return null;
  }

  return res;
}

export function restackErr(error: Error, stackErr: Error): Error {
  if ((error === null) || (typeof error !== 'object')) {
    return error;
  }
  const oldGetStack = error.stack;
  // resolve the stack at the last possible moment because stack is actually a getter
  // that will apply expensive source mapping when called
  Object.defineProperty(error, 'stack', {
    get: () => error.message + '\n' + oldGetStack + '\nPrior Context:\n' + (stackErr.stack ?? '').split('\n').slice(1).join('\n'),
    set: () => null,
  });
  return error;
}

interface IQueueItem {
  func: () => Bluebird<any>;
  stackErr: Error;
  resolve: (value: any) => void;
  reject: (err: Error) => void;
}

/**
 * create a "queue".
 * Returns an enqueue function such that that the callback passed to it
 * will be called only after everything before it in the queue is finished
 * and with the promise that nothing else in the queue is run in parallel.
 */
export function makeQueue<T>() {
  const pending: IQueueItem[] =  [];
  let processing: IQueueItem;

  const tick = () => {
    processing = pending.shift();
    if (processing !== undefined) {
      processing.func()
        .then(processing.resolve)
        .catch(err => processing.reject(restackErr(err, processing.stackErr)))
        .finally(() => {
          tick();
        });
    }
  };

  return (func: () => Bluebird<T>, tryOnly: boolean) => {
    const stackErr = new Error();

    return new Bluebird<T>((resolve, reject) => {
      if (tryOnly && (processing !== undefined)) {
        return resolve();
      }
      pending.push({ func, stackErr, resolve, reject });
      if (processing === undefined) {
        tick();
      }
    });
  };
}

/**
 * spawn this application itself
 * @param args
 */
export function spawnSelf(args: string[]) {
  if (process.execPath.endsWith('electron.exe')) {
    // development version
    args = [getVortexPath('package')].concat(args);
  }
  spawn(process.execPath, args, {
    detached: true,
  });
}

const BYTE_LABELS = [ 'B', 'KB', 'MB', 'GB', 'TB' ];

export function bytesToString(bytes: number): string {
  let labelIdx = 0;
  while (bytes >= 1024) {
    ++labelIdx;
    bytes /= 1024;
  }
  try {
    return bytes.toFixed(Math.max(0, labelIdx - 1)) + ' ' + BYTE_LABELS[labelIdx];
  } catch (err) {
    return '???';
  }
}

const NUM_LABELS = [ '', 'K', 'M' ];

export function largeNumToString(num: number): string {
  let labelIdx = 0;
  while ((num >= 1000) && (labelIdx < (NUM_LABELS.length - 1))) {
    ++labelIdx;
    num /= 1000;
  }
  try {
    return num.toFixed(Math.max(0, labelIdx - 1)) + ' ' + NUM_LABELS[labelIdx];
  } catch (err) {
    return '???';
  }
}

export function pad(value: number, padding: string, width: number) {
  const temp = `${value}`;
  return (temp.length >= width)
    ? temp
    : new Array(width - temp.length + 1).join(padding) + temp;
}

export function timeToString(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) - (hours * 60);
  seconds = Math.floor(seconds - minutes * 60 - hours * 3600);

  if (hours > 0) {
    return `${pad(hours, '0', 2)}:${pad(minutes, '0', 2)}:${pad(seconds, '0', 2)}`;
  } else {
    return `${pad(minutes, '0', 2)}:${pad(seconds, '0', 2)}`;
  }
}

let convertDiv: HTMLDivElement;

export function encodeHTML(input: string): string {
  if (input === undefined) {
    return undefined;
  }
  if (convertDiv === undefined) {
    convertDiv = document.createElement('div');
  }
  convertDiv.innerText = input;
  return convertDiv.innerHTML;
}

export function decodeHTML(input: string): string {
  if (input === undefined) {
    return undefined;
  }
  if (convertDiv === undefined) {
    convertDiv = document.createElement('div');
  }
  convertDiv.innerHTML = input;
  return convertDiv.innerText;
}

const PROP_BLACKLIST = ['constructor',
  '__defineGetter__',
  '__defineSetter__',
  'hasOwnProperty',
  '__lookupGetter__',
  '__lookupSetter__',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toString',
  'valueOf',
  '__proto__',
  'toLocaleString' ];

export function getAllPropertyNames(obj: object): string[] {
  let props: string[] = [];

  while (obj !== null) {
    const objProps = Object.getOwnPropertyNames(obj);
    // don't want the properties of the "base" object
    if (objProps.indexOf('__defineGetter__') !== -1) {
      break;
    }
    props = props.concat(objProps);
    obj = Object.getPrototypeOf(obj);
  }

  return Array.from(new Set(_.difference(props, PROP_BLACKLIST)));
}

/**
 * test if a directory is a sub-directory of another one
 * @param child path of the presumed sub-directory
 * @param parent path of the presumed parent directory
 */
export function isChildPath(child: string, parent: string, normalize?: Normalize): boolean {
  if (normalize === undefined) {
    normalize = (input) => process.platform === 'win32'
      ? path.normalize(input.toUpperCase())
      : path.normalize(input);
  }

  const childNorm = normalize(child);
  const parentNorm = normalize(parent);
  if (childNorm === parentNorm) {
    return false;
  }

  const tokens = parentNorm.split(path.sep).filter(token => token.length > 0);
  const childTokens = childNorm.split(path.sep).filter(token => token.length > 0);

  return tokens.every((token: string, idx: number) => childTokens[idx] === token);
}

export function isReservedDirectory(dirPath: string, normalize?: Normalize): boolean {
  if (normalize === undefined) {
    normalize = (input) => process.platform === 'win32'
      ? path.normalize(input.toUpperCase())
      : path.normalize(input);
  }

  const normalized = normalize(dirPath);
  const trimmed = normalized.endsWith(path.sep)
    ? normalized.slice(0, -1)
    : normalized;

  const vortexAppData = getVortexPath('userData');
  const invalidDirs = ['blob_storage', 'Cache', 'Code Cache', 'Dictionaries',
    'extensions', 'GPUCache', 'metadb', 'Partitions', 'plugins', 'Session Storage',
    'shared_proto_db', 'state.v2', 'temp', 'VideoDecodeStats']
    .map(inv => normalize(path.join(vortexAppData, inv)));
  invalidDirs.push(normalize(vortexAppData));

  return (invalidDirs.includes(trimmed));
}

export function ciEqual(lhs: string, rhs: string, locale?: string): boolean {
  return (lhs ?? '').localeCompare((rhs ?? ''), locale, { sensitivity: 'accent' }) === 0;
}

const sanitizeRE = /[ .#()]/g;

/**
 * take any input string and sanitize it into a valid css id
 */
export function sanitizeCSSId(input: string) {
  let res = input.toLowerCase()
    .replace(sanitizeRE, '-');
  if (res.endsWith('-')) {
    res += '_';
  }

  return res;
}

/**
 * remove the BOM from the input string. doesn't do anything if there is none.
 */
export function deBOM(input: string) {
  return input.replace(/^\uFEFF/, '');
}

/**
 * escape a string for use in a regular expression
 * @param string
 */
export function escapeRE(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ITimeoutOptions {
  cancel?: boolean;
  throw?: boolean;
  queryContinue?: () => Bluebird<boolean>;
}

/**
 * set a timeout for a promise. When the timeout expires the promise returned by this
 * resolves with a value of undefined (or throws a TimeoutError).
 * @param prom the promise that should be wrapped
 * @param delayMS the time in milliseconds after which this should return
 * @param options options detailing how this timeout acts
 */
export function timeout<T>(prom: Bluebird<T>,
                           delayMS: number,
                           options?: ITimeoutOptions)
                           : Bluebird<T> {
  let timedOut: boolean = false;
  let resolved: boolean = false;

  const doTimeout = () => {
    timedOut = true;
    if (options?.throw === true) {
      return Bluebird.reject(new TimeoutError());
    } else {
      return undefined;
    }
  };

  const onTimeExpired = () => {
    if (resolved) {
      return Bluebird.resolve();
    }
    if (options?.queryContinue !== undefined) {
      return options?.queryContinue()
        .then(requestContinue => {
          if (requestContinue) {
            delayMS *= 2;
            return Bluebird.delay(delayMS).then(onTimeExpired);
          } else {
            return doTimeout();
          }
        });
    } else {
      return doTimeout();
    }
  };

  return Bluebird.race<T>([prom, Bluebird.delay(delayMS).then(onTimeExpired)])
    .finally(() => {
      resolved = true;
      if (timedOut && (options?.cancel === true)) {
        prom.cancel();
      }
    });
}

/**
 * wait for the specified number of milliseconds before resolving the promise.
 * Bluebird has this feature as Promise.delay but when using es6 default promises this can be used
 */
export function delay(timeoutMS: number): Bluebird<void> {
  return new Bluebird(resolve => {
    setTimeout(resolve, timeoutMS);
  });
}

/**
 * characters invalid in a file path
 */
const INVALID_FILEPATH_CHARACTERS = process.platform === 'win32'
      ? ['/', '?', '*', ':', '|', '"', '<', '>']
      : [];

/**
 * characters invalid in a file name
 */
const INVALID_FILENAME_CHARACTERS = [].concat(INVALID_FILEPATH_CHARACTERS, path.sep);

const INVALID_FILENAME_RE = new RegExp(`[${escapeRE(INVALID_FILENAME_CHARACTERS.join(''))}]`, 'g');

const RESERVED_NAMES = new Set(process.platform === 'win32'
  ? [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    '..', '.',
  ]
  : [ '..', '.' ]);

export function isFilenameValid(input: string): boolean {
  if (input.length === 0) {
    return false;
  }
  if (RESERVED_NAMES.has(path.basename(input, path.extname(input)).toUpperCase())) {
    return false;
  }
  if ((process.platform === 'win32')
    && (input.endsWith(' ') || input.endsWith('.'))) {
    // Although Windows' underlying file system may support
    //  filenames/dirnames ending with '.' and ' ', the win shell and UI does not.
    return false;
  }
  return input.search(INVALID_FILENAME_RE) < 0;
}

function isDriveLetter(input: string): boolean {
  return (process.platform === 'win32')
    && (input.length === 2)
    && (input[1] === ':');
}

/**
 * encodes a string so it can safely be used as a filename
 */
export function sanitizeFilename(input: string): string {
  if (input.length === 0) {
    return '_empty_';
  }
  if (RESERVED_NAMES.has(path.basename(input, path.extname(input)).toUpperCase())) {
    return path.join(path.dirname(input), '_reserved_' + path.basename(input));
  }
  if ((process.platform === 'win32')
    && (input.endsWith(' ') || input.endsWith('.'))) {
    // Although Windows' underlying file system may support
    //  filenames/dirnames ending with '.' and ' ', the win shell and UI does not.
    return input + '_';
  }
  return input.replace(INVALID_FILENAME_RE, invChar => `_${invChar.charCodeAt(0)}_`);
}

const trimTrailingSep = new RegExp(`\\${path.sep}*$`, 'g');

export function isPathValid(input: string, allowRelative: boolean = false): boolean {
  if ((process.platform === 'win32') && input.startsWith('\\\\')) {
    // UNC path, skip the leading \\ for validation
    input = input.slice(2);
  } else if ((process.platform !== 'win32') && input.startsWith('/')) {
    input = input.slice(1);
  }
  let split = input.replace(trimTrailingSep, '').split(path.sep);
  if (allowRelative) {
    split = split.filter(segment => (segment !== '.') && (segment !== '..'));
  }
  const found = split.find((segment: string, idx: number) => {
    if (idx === 0 && isDriveLetter(segment)) {
      return false;
    }
    return !isFilenameValid(segment);
  });

  return found === undefined;
}

export {
  INVALID_FILEPATH_CHARACTERS,
  INVALID_FILENAME_RE,
  INVALID_FILENAME_CHARACTERS,
};

// test if the running version is a major downgrade (downgrading by a major or minor version,
// everything except a patch) compared to what was running last
export function isMajorDowngrade(previous: string, current: string): boolean {
  const majorL = semver.major(previous);
  const majorR = semver.major(current);

  if (majorL !== majorR) {
    return majorL > majorR;
  } else {
    return semver.minor(previous) > semver.minor(current);
  }
}

export interface IFlattenParameters {
  // maximum length of arrays. If this is not set the result object may become *huge*!
  maxLength?: number;
  // separator to use between keys. defaults to '.'
  separator?: string;
  // the base key that will be included in all attribute names. You will usually want
  // to leave this as an empty array unless the result gets merged with something else
  baseKey?: string[];
  // also include non-enumerable properties
  nonEnumerable?: boolean;
}

/**
 * turn an object into a flat one meaning all values are PODs, no nested objects/arrays
 * @param obj the input object
 * @param options parameters controlling the flattening process
 */
export function flatten(obj: any, options?: IFlattenParameters): any {
  if (options === undefined) {
    options = {};
  }
  options.separator = options.separator || '.';
  options.baseKey = options.baseKey || [];

  return flattenInner(obj, options.baseKey, [], options);
}

function flattenInner(obj: any, key: string[],
                      objStack: any[],
                      options: IFlattenParameters): any {
  if ((obj.length !== undefined) && (obj.length > 10)) {
    return { [key.join(options.separator)]: '<long array cut>' };
  }
  const getKeys = options.nonEnumerable
    ? Object.getOwnPropertyNames
    : Object.keys;
  return getKeys(obj).reduce((prev, attr: string) => {
    if (objStack.indexOf(obj[attr]) !== -1) {
      return prev;
    }
    if ((typeof(obj[attr]) === 'object') && (obj[attr] !== null)) {
      prev = {
        ...prev,
        ...flattenInner(obj[attr], [...key, attr], [].concat(objStack, [obj[attr]]), options),
      };
    } else {
      // POD
      prev[[...key, attr].join(options.separator)] = obj[attr];
    }
    return prev;
  }, {});
}

export function toPromise<ResT>(func: (cb) => void): Bluebird<ResT> {
  return new Bluebird((resolve, reject) => {
    const cb = (err: Error, res: ResT) => {
      if ((err !== null) && (err !== undefined)) {
        return reject(err);
      } else {
        return resolve(res);
      }
    };
    func(cb);
  });
}

export function makeUnique<T>(input: T[]): T[] {
  return Array.from(new Set(input));
}

/**
 * create a list with only "unique" items, using a key function to determine uniqueness.
 * in case of collisions the last item with a key is kept
 * @param input the input list of items
 * @param key key function
 * @returns a list with duplicates removed
 */
export function makeUniqueByKey<T>(input: T[], key: (item: T) => string): T[] {
  return Object.values(input.reduce((prev, item) => { prev[key(item)] = item; return prev; }, {}));
}

export function withTmpDir<T>(cb: (tmpPath: string) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tmp.dir({ unsafeCleanup: true }, (err, tmpPath, cleanup) => {
      if (err !== null) {
        return reject(err);
      } else {
        cb(tmpPath)
          .then((out: T) => {
            resolve(out);
          })
          .catch(tmpErr => {
            reject(tmpErr);
          })
          .finally(() => {
            try {
              cleanup();
            } catch (err) {
              // cleanup failed
              log('warn', 'Failed to clean up temp file', { tmpPath });
            }
          });
      }
    });
  });
}

export function unique<T, U>(input: T[], keyFunc?: (item: T) => U): T[] {
  const keys = new Set<U>();
  return input.reduce((prev: T[], iter: T) => {
    const key = keyFunc?.(iter);
    if (keys.has(key)) {
      return prev;
    }
    keys.add(key);
    return [].concat(prev, iter);
  }, []);
}

export function delayed(delayMS: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMS);
  });
}

export function toBlue<T, ArgsT extends any[]>(
  func: (...args: ArgsT) => Promise<T>)
  : (...args: ArgsT) => Bluebird<T> {
  return (...args: ArgsT) => Bluebird.resolve(func(...args));
}

export function replaceRecursive(input: any, from: any, to: any) {
  if ((input === undefined)
      || (input === null)
      || Array.isArray(input)) {
    return input;
  }
  return Object.keys(input)
    .reduce((prev: any, key: string) => {
      if (input[key] === from) {
        prev[key] = to;
      } else if (typeof(input[key]) === 'object') {
        prev[key] = replaceRecursive(input[key], from, to);
      } else {
        prev[key] = input[key];
      }
      return prev;
    }, {});
}

function removeLeadingZeros(input: string): string {
  if (!input) { return input; }
  return input.split('.').map(seg => seg.replace(/^0+(\d+$)/, '$1')).join('.');
}

export function semverCoerce(input: string): semver.SemVer {
  let res = semver.coerce(removeLeadingZeros(input));

  if (res === null) {
    res = (input === '')
      ? new semver.SemVer('0.0.0')
      : new semver.SemVer(`0.0.0-${input}`);
  }

  return res;
}

// TODO: support thunk actions?
export function batchDispatch(store: Redux.Dispatch | Redux.Store, actions: Redux.Action[]) {
  const dispatch = store['dispatch'] ?? store;
  if (actions.length > 0) {
    dispatch(batch(actions));
  }
}

export function isFunction(functionToCheck) {
  return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}

/**
 * wrap a callback provided by an extension such that we don't allow reports
 * for that extension and display the extension name if possible
 * @param cb the callback to wrap
 * @param ext name of the extension that provided the callback
 * @returns a new callback with an identical call signature
 *
 * @note As a side-effect this also ensures promises returned from the extension
 *       are bluebird extensions.
 *       This should allow extension authors to use native extension without
 *       causing surprising bugs
 */
export function wrapExtCBAsync<ArgT extends any[], ResT>(
  cb: (...args: ArgT) => PromiseLike<ResT>,
  extInfo?: { name: string, official: boolean })
  : (...args: ArgT) => Bluebird<ResT> {

  return (...args: ArgT): Bluebird<ResT> => {
    try {
      return Bluebird.resolve(cb(...args))
        .catch?.(err => {
          if (typeof(err) === 'string') {
            err = new Error(err);
          }
          if ((extInfo !== undefined) && !extInfo.official) {
            err.allowReport = false;
            err.extensionName = extInfo.name;
          }
          return Promise.reject(err);
        });
    } catch (err) {
      err.allowReport = false;
      if ((extInfo !== undefined) && !extInfo.official) {
        err.extensionName = extInfo.name;
      }
      return Bluebird.reject(err);
    }
  };
}

export function wrapExtCBSync<ArgT extends any[], ResT>(
  cb: (...args: ArgT) => ResT,
  extInfo?: { name: string, official: boolean })
  : (...args: ArgT) => ResT {

  return (...args: ArgT): ResT => {
    try {
      return cb(...args);
    } catch (err) {
      if ((extInfo !== undefined) && !extInfo.official) {
        err.allowReport = false;
        err.extensionName = extInfo.name;
      }
      throw err;
    }
  };
}

export enum Section {
  Mods,
  Collections,
  Users,
}

export enum Campaign {
  ViewCollection = 'view_collection',
  ViewCollectionAsCurator = 'curator_view_collection',
  BuyPremium = 'buy_premium'
}

export enum Source {
  HeaderAd = 'header_ad',
  DownloadsBannerAd = 'downloads_banner_ad',
  DownloadsNagAd = 'downloads_nag_ad',
  DashboardAd = 'dashboard_ad',
  CollectionsAd = 'collections_ad',
  SettingsAd = 'settings_ad'
}

export interface INexusURLOptions {
  section?: Section;
  source?: Source;
  campaign?: Campaign | string;
  parameters?: string[];
}

function sectionHost(section?: Section) {
  switch (section) {
    case Section.Collections: return `${NEXUS_NEXT_SUBDOMAIN}.${NEXUS_DOMAIN}`;
    case Section.Users: return `${NEXUS_USERS_SUBDOMAIN}.${NEXUS_DOMAIN}`;
    default: return `${NEXUS_FLAMEWORK_SUBDOMAIN}.${NEXUS_DOMAIN}`;
  }
}

export function nexusModsURL(reqPath: string[], options?: INexusURLOptions): string {

  // if no parameters set, then just empty array to start
  const parameters = options?.parameters ?? []; 
  
  // if we have a campaign, then we want to track some data  
  if (options?.campaign !== undefined) {

    // always need this and will always be 'vortex'
    parameters.push('utm_medium=vortex');

    // source is location within vortex if we want to differenciate, if not, then just 'vortex' 
    const source = options?.source ?? 'vortex'; 
    parameters.push(`utm_source=${source}`);
    
    // we add the campaign
    parameters.push(`utm_campaign=${options.campaign.toString()}`);
  }

  const urlParameters: url.UrlObject = {
    protocol: NEXUS_PROTOCOL,
    host: sectionHost(options?.section),
  };
  if (reqPath.length > 0) {
    urlParameters.pathname = '/' + reqPath.join('/');
  }
  if (parameters.length > 0) {
    urlParameters.search = '?' + parameters.join('&');
  }

  return url.format(urlParameters);
}

// environment variables we might have set for ourselves or passed in by chrome/electron/node
const noInheritEnv: string[] = [
  'BLUEBIRD_DEBUG', 'CHROME_CRASHPAD_PIPE_NAME', 'DEBUG_REACT_RENDERS',
  'DOTNET_SYSTEM_GLOBALIZATION_INVARIANT',
  'FORCE_ALLOW_ELEVATED_SYMLINKING', 'HIGHLIGHT_I18N', 'IS_PREVIEW_BUILD',
  'NEXUS_NEXT_URL', 'NODE_ENV', 'NODE_OPTIONS', 'SIMULATE_FS_ERRORS', 'UV_THREADPOOL_SIZE',
];

export function filteredEnvironment(): NodeJS.ProcessEnv {
  return _.omit(process.env, noInheritEnv);
}

export function parseBool(input: string): boolean {
  return ['true', 'yes', '1'].includes((input ?? '').toLowerCase());
}

export class Overlayable<KeyT extends string | number | symbol, ObjT> {
  private mBaseData: Record<KeyT, ObjT>;
  private mLayers: { [layer: string]: Record<KeyT, Partial<ObjT>> } = {};
  private mDeduce: (key: KeyT, extraArg: any) => string;

  public constructor(baseData: Record<KeyT, ObjT>,
                     deduceLayer: (key: KeyT, extraArg: any) => string) {
    this.mBaseData = baseData;
    this.mDeduce = deduceLayer;
  }

  public setLayer(layerId: string, data: Record<KeyT, Partial<ObjT>>) {
    this.mLayers[layerId] = data;
  }

  public keys(): string[] {
    return Object.keys(this.mBaseData);
  }

  public has(key: KeyT): boolean {
    return this.mBaseData[key] !== undefined;
  }

  public get<AttrT extends keyof ObjT, ValT extends ObjT[AttrT]>(
    key: KeyT, attr: AttrT, extraArg?: any): ValT {

    const layer = this.mDeduce(key, extraArg);
    if (layer === undefined) {
      return this.mBaseData[key]?.[attr] as ValT;
    }
    return (this.mLayers[layer]?.[key]?.[attr] as any)
        ?? this.mBaseData[key]?.[attr];
  }

  public get baseData() {
    return this.mBaseData;
  }
}

const proxyHandler: ProxyHandler<Overlayable<any, any>> = {
  ownKeys(target) {
    return Reflect.ownKeys(target.baseData);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (Reflect.has(target, prop)) {
      return Reflect.getOwnPropertyDescriptor(target,  prop);
    } else {
      return {
        enumerable: true,
        configurable: true
      };
    }
  },
  has(target, prop) {
    return Reflect.has(target, prop) || target.baseData[prop as any];
  },
  get(target, prop, receiver) {
    return Reflect.get(target, prop, receiver) ?? target.baseData[prop as any];
  },
}

/**
 * helper function to create a dictionary that can have conditional
 * overlays applied to it
 * @param baseData the base data object
 * @param layers keyed layers 
 * @param deduceLayer determine the layer to be used for a given key. If this returns 
 * @returns 
 */
export function makeOverlayableDictionary<KeyT extends string | number | symbol, ValueT>(
  baseData: Record<KeyT, ValueT>,
  layers: { [layerId: string]: Record<KeyT, Partial<ValueT>> },
  deduceLayer: (key: KeyT, extraArg: any) => string): Overlayable<KeyT, ValueT> {

  const res = new Overlayable<KeyT, ValueT>(baseData, deduceLayer);
  for (const layerId of Object.keys(layers)) {
    res.setLayer(layerId, layers[layerId]);
  }

  return new Proxy(res, proxyHandler);
}
