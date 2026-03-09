import crypto from 'crypto';
import path from 'path';
import { fs, util } from 'vortex-api';
export class MD5ComparisonError extends Error {
  private mPath;
  constructor(message, file) {
    super(message);
    this.mPath = file;
  }

  get affectedFile() {
    return this.mPath;
  }

  get errorMessage() {
    return this.message + ': ' + this.mPath;
  }
}

export class ResourceInaccessibleError extends Error {
  private mIsReportingAllowed;
  private mFilePath;
  constructor(filePath, allowReport = false) {
    super(`"${filePath}" is being manipulated by another process`);
    this.mFilePath = filePath;
    this.mIsReportingAllowed = allowReport;
  }

  get isOneDrive() {
    const segments = this.mFilePath.split(path.sep)
      .filter(seg => !!seg)
      .map(seg => seg.toLowerCase());
    return segments.includes('onedrive');
  }

  get allowReport() {
    return this.mIsReportingAllowed;
  }

  get errorMessage() {
    return (this.isOneDrive)
      ? this.message + ': ' + 'probably by the OneDrive service.'
      : this.message + ': ' + 'close all applications that may be using this file.';
    }
}

export class MergeDataViolationError extends Error {
  // Merge data violation errors intends to cater for/block curators
  //  from uploading a collection with faulty merged data.
  // We define faulty merged data as:
  //  1. A merged script segment which relies on a certain mod to be included in the
  //     collection, yet it is not included.
  //  2. A merged script segment which requires a specific mod to be installed,
  //     yet the collection highlighted said mod as "optional"; potentially
  //     resulting in the mod being missing on the user end.
  private mNotIncluded: string[];
  private mOptional: string[];
  private mCollectionName: string;
  constructor(notIncluded: string[], optional: string[], collectionName: string) {
    super(`Merged script data for ${collectionName} is referencing missing/undeployed/optional mods`);
    this.name = 'MergeDataViolationError';
    this.mOptional = optional;
    this.mNotIncluded = notIncluded;
    this.mCollectionName = collectionName;
  }

  public get Optional() {
    return this.mOptional;
  }

  public get NotIncluded() {
    return this.mNotIncluded;
  }

  public get CollectionName() {
    return this.mCollectionName
  }
}

export function calcHashImpl(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('readable', () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function getHash(filePath, tries = 3) {
  return calcHashImpl(filePath)
    .catch(err => {
      if (['EMFILE', 'EBADF'].includes(err['code']) && (tries > 0)) {
        return getHash(filePath, tries - 1);
      } else {
        return Promise.reject(err);
      }
    });
}

export function getLoadOrderFilePath() {
  return path.join(util.getVortexPath('documents'), 'The Witcher 3', LOAD_ORDER_FILENAME);
}

export function getPriorityTypeBranch() {
  return ['settings', 'witcher3', 'prioritytype'];
}

export function getSuppressModLimitBranch() {
  return ['settings', 'witcher3', 'suppressModLimitPatch'];
}

export const GAME_ID = 'witcher3';

// File used by some mods to define hotkey/input mapping
export const INPUT_XML_FILENAME = 'input.xml';

// The original file is backed up on deployment - we will use the backup
//  during merges if it exists.
export const VORTEX_BACKUP_TAG = '.vortex_backup';

// The W3MM menu mod pattern seems to enforce a modding pattern
//  where {filename}.part.txt holds a diff of what needs to be
//  added to the original file - we're going to use this pattern as well.
export const PART_SUFFIX = '.part.txt';

export const SCRIPT_MERGER_ID = 'W3ScriptMerger';
export const MERGE_INV_MANIFEST = 'MergeInventory.xml';
export const LOAD_ORDER_FILENAME = 'mods.settings';
export const I18N_NAMESPACE = 'game-witcher3';
export const CONFIG_MATRIX_REL_PATH = path.join('bin', 'config', 'r4game', 'user_config_matrix', 'pc');
export const CONFIG_MATRIX_FILES = ['audio', 'display', 'gameplay', 'gamma', 'graphics',
  'graphicsdx11', 'hdr', 'hidden', 'hud', 'input', 'localization'];

export const W3_TEMP_DATA_DIR = path.join(util.getVortexPath('temp'), 'W3TempData');

export const UNI_PATCH = 'mod0000____CompilationTrigger';
export const LOCKED_PREFIX = 'mod0000_';

export const DO_NOT_DISPLAY = ['communitypatch-base'];
// minimatch is supposed to be case-insensitive, but it's not working for some reason...
export const DO_NOT_DEPLOY = ['README.TXT', `**/*${PART_SUFFIX.toUpperCase()}`];
export const SCRIPT_MERGER_FILES = ['WitcherScriptMerger.exe'];

export const NON_SORTABLE = ['witcher3menumoddocuments', 'collection'];

export const ACTIVITY_ID_IMPORTING_LOADORDER = 'activity-witcher3-importing-loadorder';