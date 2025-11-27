import { ILOOTList, ILOOTPlugin } from '../types/ILOOTList';

import {gameSupported} from './gameSupport';

import * as RemoteT from '@electron/remote';
import Promise from 'bluebird';
import { dialog as dialogIn } from 'electron';
import { dump, load } from 'js-yaml';
import * as _ from 'lodash';
import * as path from 'path';
import { fs, types, util } from 'vortex-api';

const remote = util.lazyRequire<typeof RemoteT>(() => require('@electron/remote'));

/**
 * persistor syncing to and from the loot userlist.yaml file
 *
 * @class UserlistPersistor
 * @implements {types.IPersistor}
 */
class UserlistPersistor implements types.IPersistor {
  private mResetCallback: () => void;
  private mUserlistPath: string;
  private mUserlist: ILOOTList;
  private mSerializeQueue: Promise<void> = Promise.resolve();
  private mLoaded: boolean = false;
  private mFailed: boolean = false;
  private mLoadedPromise: Promise<void>;
  private mMode: 'userlist' | 'masterlist';
  private mOnError: (message: string, details: Error, options?: types.IErrorOptions) => void;

  constructor(mode: 'userlist' | 'masterlist',
              onError: (message: string, details: Error) => void) {
    this.mUserlist = {
      globals: [],
      plugins: [],
      groups: [],
    };
    this.mOnError = onError;
    this.mMode = mode;
    this.mLoadedPromise = new Promise((resolve, reject) => {
      this.mOnLoaded = resolve;
    });
}

  public wait(): Promise<void> {
    return this.mLoadedPromise;
  }

  public disable(): Promise<void> {
    return this.enqueue(() => new Promise<void>(resolve => {
      this.mUserlist = {
        globals: [],
        plugins: [],
        groups: [],
      };
      this.mUserlistPath = undefined;
      this.mLoaded = false;
      this.mLoadedPromise = new Promise((loadResolve, reject) => {
        this.mOnLoaded = loadResolve;
      });
      if (this.mResetCallback) {
        this.mResetCallback();
      }
      resolve();
    }));
  }

  public loadFiles(gameMode: string): Promise<void> {
    if (!gameSupported(gameMode)) {
      return Promise.resolve();
    }
    this.mUserlistPath = (this.mMode === 'userlist')
      ? path.join(util.getVortexPath('userData'), gameMode, 'userlist.yaml')
      : path.join(util.getVortexPath('userData'), gameMode, 'masterlist', 'masterlist.yaml');

    // read the files now and update the store
    return this.deserialize();
  }

  public setResetCallback(cb: () => void) {
    this.mResetCallback = cb;
  }

  public getItem(key: string[]): Promise<string> {
    if ((key.length === 1) && (key[0] === '__isLoaded')) {
      return Promise.resolve(this.mLoaded ? 'true' : 'false');
    }
    return Promise.resolve(JSON.stringify(this.mUserlist[key[0]]));
  }

  public setItem(key: string[], value: string): Promise<void> {
    this.mUserlist[key[0]] = JSON.parse(value);
    return this.serialize();
  }

  public removeItem(key: string[]): Promise<void> {
    this.mUserlist[key[0]] = [];
    return this.serialize();
  }

  public getAllKeys(): Promise<string[][]> {
    return Promise.resolve([].concat(['__isLoaded'], Object.keys(this.mUserlist))
                             .map(key => [key]));
  }

  private mOnLoaded: () => void = () => null;

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.mSerializeQueue = this.mSerializeQueue.then(fn);
    return this.mSerializeQueue;
  }

  private reportError(message: string, detail: Error, options?: types.IErrorOptions) {
    if (!this.mFailed) {
      this.mOnError(message, detail, options);
      this.mFailed = true;
    }
  }

  private serialize(): Promise<void> {
    if (!this.mLoaded) {
      // this happens during initialization, when the persistor is initially created, with default
      // values.
      return Promise.resolve();
    }
    // ensure we don't try to concurrently write the files
    this.mSerializeQueue = this.mSerializeQueue.then(() => this.doSerialize());
    return this.mSerializeQueue;
  }

  private doSerialize(): Promise<void> {
    if ((this.mUserlist === undefined)
        || (this.mUserlistPath === undefined)
        || (this.mMode === 'masterlist')) {
      return;
    }

    const userlistPath = this.mUserlistPath;

    return fs.writeFileAsync(userlistPath + '.tmp',
                             dump(_.omit(this.mUserlist, ['__isLoaded'])))
      .then(() => fs.renameAsync(userlistPath + '.tmp', userlistPath))
      .then(() => { this.mFailed = false; })
      .catch(util.UserCanceled, () => undefined)
      .catch(err => {
        this.reportError('Failed to write userlist', err);
      });
  }

  private handleInvalidList() {
    const dialog = process.type === 'renderer'
      ? remote.dialog
      : dialogIn;

    let res = 0;
    if (this.mMode === 'masterlist') {
      res = dialog.showMessageBoxSync(null, {
        title: 'Masterlist invalid',
        message: `The masterlist "${this.mUserlistPath}" can\'t be read. `
               + '\n\n'
               + 'If you continue now, the masterlist will be reset.',

        buttons: [
          'Reset Masterlist',
          'Quit Vortex'
        ],
      });
    } else {
      res = dialog.showMessageBoxSync(null, {
        title: 'Userlist invalid',
        message: `The LOOT userlist "${this.mUserlistPath}" can\'t be read. `
               + '\n\n'
               + 'You should quit Vortex now and repair the file.\n'
               + 'If (and only if!) you\'re certain you didn\'t modify the file yourself, '
               + 'please send in a bug report with that file attached.'
               + '\n\n'
               + 'If you continue now, the userlist will be reset and all your plugin '
               + 'rules and group assignments will be lost.',
        noLink: true,
        defaultId: 1,
        buttons: [
          'Reset Userlist',
          'Quit Vortex',
        ],
      });
    }

    if (res === 1) {
      util.getApplication().quit();
    } else {
      fs.removeSync(this.mUserlistPath);
    }
  }

  private makeCaseInsensitive<T>(list: ILOOTPlugin[]): ILOOTPlugin[] {
    const keysU = {};

    const mapKey = (key: string, idx: number): number => {
      const keyU = key.toUpperCase();
      const mapped = keysU[keyU];
      if (mapped === undefined) {
        keysU[keyU] = idx;
        return -1;
      } else {
        return mapped;
      }
    };

    return list.reduce((prev, plugin) => {
      const mappedIdx = mapKey(plugin.name, prev.length);
      if (mappedIdx === -1) {
        prev.push(plugin);
      } else {
        prev[mappedIdx] = _.merge(prev[mappedIdx], plugin);
      }
      return prev;
    }, []);
  }

  private deserialize(): Promise<void> {
    if (this.mUserlist === undefined) {
      return Promise.resolve();
    }

    let empty: boolean = false;

    return fs.readFileAsync(this.mUserlistPath)
    .then((data: Buffer) => {
      if (data.byteLength <= 5) {
        // the smallest non-empty file is actually around 20 bytes long and
        // the smallest useful file probably 30. This is really to catch
        // cases where the file is not parseable because it's completely empty
        // or contains only "null" or something silly like that
        empty = true;
      }

      let newList: Partial<ILOOTList> = {};
      try {
        newList = load(data.toString(), { json: true }) as any;
      } catch (err) {
        this.handleInvalidList();
      }
      if (typeof (newList) !== 'object') {
        this.handleInvalidList();
      }

      ['globals', 'plugins', 'groups'].forEach(key => {
        if ([null, undefined].indexOf(newList[key]) !== -1) {
          newList[key] = [];
        }
      });

      const newPlugins = this.makeCaseInsensitive(newList.plugins);
      const didChange = (newPlugins.length !== newList.plugins.length);
      newList.plugins = newPlugins;

      this.mUserlist = newList as ILOOTList;
      if (this.mResetCallback) {
        this.mResetCallback();
        this.mLoaded = true;
        this.mOnLoaded();
      }
      if (didChange) {
        return this.serialize();
      } else {
        return Promise.resolve();
      }
    })
    .catch(err => {
      if ((err.code === 'ENOENT') || empty) {
        this.mUserlist = {
          globals: [],
          plugins: [],
          groups: [],
        };
        this.mLoaded = true;
        this.mOnLoaded();
        return this.serialize();
      } else {
        // if we can't read the file but the file is there,
        // we would be destroying its content if we don't quit right now.
        util.terminate({
          message: 'Failed to read userlist file for this game. '
                 + 'Repair or delete this file and then try to start Vortex again',
          path: this.mUserlistPath,
          details: `Error: ${err.message}`,
        }, undefined, false);
      }
    });
  }
}

export default UserlistPersistor;
