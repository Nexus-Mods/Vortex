import {ILoadOrder} from '../types/ILoadOrder';
import {
  gameSupported,
  nativePlugins,
  pluginFormat,
  pluginPath,
} from '../util/gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {decode, encode} from 'iconv-lite';
import * as _ from 'lodash';
import * as path from 'path';
import {log, types, util} from 'vortex-api';

export type PluginFormat = 'original' | 'fallout4';

interface IPluginMap {
  [name: string]: ILoadOrder;
}

const retryCount = 3;

/**
 * persistor syncing to and from the gamebryo plugins.txt and loadorder.txt
 *
 * @class PluginPersistor
 * @implements {types.IPersistor}
 */
class PluginPersistor implements types.IPersistor {
  private mPluginPath: string;
  private mPluginFormat: PluginFormat;
  private mNativePlugins: Set<string>;
  private mResetCallback: () => void;

  private mWatch: fs.FSWatcher;
  private mRefreshTimer: NodeJS.Timer;
  private mSerializing: boolean = false;
  private mSerializeQueue: Promise<void> = Promise.resolve();

  private mPlugins: IPluginMap;
  private mRetryCounter: number = retryCount;
  private mLoaded: boolean = false;
  private mFailed: boolean = false;
  private mOnError: (message: string, details: Error) =>  void;

  constructor(onError: (message: string, details: Error) => void) {
    this.mPlugins = {};
    this.mOnError = onError;
  }

  public disable(): Promise<void> {
    return this.enqueue(() => new Promise<void>(resolve => {
      this.mPlugins = {};
      this.mPluginPath = undefined;
      this.mPluginFormat = undefined;
      this.mNativePlugins = undefined;
      this.mLoaded = false;
      if (this.mResetCallback) {
        this.mResetCallback();
        this.mRetryCounter = retryCount;
      }
      this.stopWatch();
      resolve();
    }));
  }

  public loadFiles(gameMode: string): Promise<void> {
    return this.enqueue(() => new Promise<void>(resolve => {
      if (!gameSupported(gameMode)) {
        return resolve();
      }
      this.mPluginPath = pluginPath(gameMode);
      this.mPluginFormat = pluginFormat(gameMode);
      this.mNativePlugins = new Set(nativePlugins(gameMode));
      log('debug', 'synching plugins', {pluginsPath: this.mPluginPath});
      // read the files now and update the store
      this.deserialize();
      // start watching for external changes
      this.startWatch();
      resolve();
    }));
  }

  public setResetCallback(cb: () => void) {
    this.mResetCallback = cb;
  }

  public getItem(key: string, cb?: (error: Error, result?: string) => void): Promise<any> {
    const res = JSON.stringify(this.mPlugins);
    if (cb) {
      cb(null, res);
    }
    return Promise.resolve(res);
  }

  public setItem(key: string, value: string, cb?: (error: Error) => void): Promise<void> {
    const newPlugins = JSON.parse(value);
    if (!_.isEqual(newPlugins, this.mPlugins)) {
      this.mPlugins = newPlugins;
      return this.serialize().then(() => cb && cb(null));
    }
  }

  public removeItem(key: string, cb?: (error: Error) => void): Promise<void> {
    delete this.mPlugins[key];
    return this.serialize().then(() => cb && cb(null));
  }

  public getAllKeys(cb?: (error: Error, keys?: string[]) => void): Promise<void> {
    if (cb) {
      cb(null, ['loadOrder']);
    }
    return Promise.resolve();
  }

  private reportError(message: string, detail: Error) {
    if (!this.mFailed) {
      this.mOnError(message, detail);
      this.mFailed = true;
    }
  }

  private toPluginList(input: string[]) {
    if (this.mPluginFormat === 'original') {
      return this.toPluginListOriginal(input);
    } else {
      return this.toPluginListFallout4(input);
    }
  }

  private toPluginListOriginal(input: string[]) {
    return input.filter(
        (pluginName: string) => util.getSafe(this.mPlugins, [pluginName, 'enabled'], false));
  }

  private toPluginListFallout4(input: string[]) {
    return input.map((name: string) => {
      if (util.getSafe(this.mPlugins, [name, 'enabled'], false)) {
        return '*' + name;
      } else {
        return name;
      }
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.mSerializeQueue = this.mSerializeQueue.then(fn);
    return this.mSerializeQueue;
  }

  private serialize(): Promise<void> {
    if (!this.mLoaded) {
      // this happens during initialization, when the persistor is initially created
      return Promise.resolve();
    }
    // ensure we don't try to concurrently write the files
    return this.enqueue(() => this.doSerialize());
  }

  private doSerialize(): Promise<void> {
    if (this.mPluginPath === undefined) {
      return;
    }
    const destPath = this.mPluginPath;

    this.mSerializing = true;

    const sorted: string[] =
        Object.keys(this.mPlugins)
            .filter((pluginName: string) =>
                        !this.mNativePlugins.has(pluginName.toLowerCase()))
            .sort((lhs: string, rhs: string) => this.mPlugins[lhs].loadOrder -
                                                this.mPlugins[rhs].loadOrder);
    const loadOrderFile = path.join(destPath, 'loadorder.txt');
    const pluginsFile = path.join(destPath, 'plugins.txt');
    // log('debug', 'serialize to', { loadOrderFile, pluginsFile });
    return fs.writeFileAsync(loadOrderFile,
      encode('# Automatically generated by Vortex\r\n' + sorted.join('\r\n'), 'utf-8'))
      .then(() => {
        const filtered: string[] = this.toPluginList(sorted);
        return fs.writeFileAsync(pluginsFile,
          encode('# Automatically generated by Vortex\r\n' + filtered.join('\r\n'), 'latin-1'));
      })
      .then(() => { this.mFailed = false; })
      .catch(err => {
        this.reportError('failed to write plugin list', err);
      })
      .finally(() => {
        this.mSerializing = false;
      })
      ;
  }

  private filterFileData(input: string, plugins: boolean): string[] {
    const res = input.split(/\r?\n/).filter((value: string) => {
        return !value.startsWith('#') && (value.length > 0);
      });

    return res;
  }

  private initFromKeyList(plugins: IPluginMap, keys: string[], enabled: boolean) {
    let loadOrderPos = Object.keys(plugins).length;
    keys.forEach((key: string) => {
      const keyEnabled = enabled && ((this.mPluginFormat === 'original') || (key[0] === '*'));
      if ((this.mPluginFormat === 'fallout4') && (key[0] === '*')) {
        key = key.slice(1);
      }
      // ignore "native" plugins
      if (this.mNativePlugins.has(key.toLowerCase())) {
        return;
      }
      if (plugins[key] !== undefined) {
        plugins[key].enabled = keyEnabled;
      } else {
        plugins[key] = {
          enabled: keyEnabled,
          loadOrder: loadOrderPos++,
        };
      }
    });
  }

  private deserialize(retry: boolean = false): Promise<void> {
    if (this.mPluginPath === undefined) {
      return;
    }

    const newPlugins: IPluginMap = {};

    const pluginsFile = path.join(this.mPluginPath, 'plugins.txt');

    let phaseOne: Promise<NodeBuffer>;
    if (this.mPluginFormat === 'original') {
      const loadOrderFile = path.join(this.mPluginPath, 'loadorder.txt');
      log('debug', 'deserialize', { format: this.mPluginFormat, pluginsFile, loadOrderFile });
      phaseOne = fs.readFileAsync(loadOrderFile)
        .then((data: NodeBuffer) => {
          const keys: string[] =
            this.filterFileData(decode(data, 'utf-8'), false);
          this.initFromKeyList(newPlugins, keys, false);
          return fs.readFileAsync(pluginsFile);
        });
    } else {
      // log('debug', 'deserialize', { format: this.mPluginFormat, pluginsFile });
      phaseOne = fs.readFileAsync(pluginsFile);
    }
    return phaseOne
    .then((data: NodeBuffer) => {
      if ((data.length === 0) && !retry) {
        // not even a header? I don't trust this
        // TODO: This is just a workaround
        return this.deserialize(true);
      }
      const keys: string[] = this.filterFileData(decode(data, 'latin-1'), true);
      this.initFromKeyList(newPlugins, keys, true);
      this.mPlugins = newPlugins;
      this.mLoaded = true;
      if (this.mResetCallback) {
        this.mResetCallback();
        this.mRetryCounter = retryCount;
      }
      this.mFailed = false;
    })
    .catch((err: any) => {
      if (err.code && (err.code === 'ENOENT')) {
        this.mLoaded = true;
        return;
      }
      log('warn', 'failed to read plugin file',
        { pluginPath: this.mPluginPath, error: require('util').inspect(err) });
      if (this.mRetryCounter > 0) {
        --this.mRetryCounter;
        this.scheduleRefresh(100);
      } else {
        // giving up...
        this.mLoaded = true;
        this.reportError('failed to read plugin list', err);
      }
    });
  }

  private scheduleRefresh(timeout: number) {
    if (this.mRefreshTimer !== null) {
      clearTimeout(this.mRefreshTimer);
    }
    this.mRefreshTimer = setTimeout(() => {
      this.mRefreshTimer = null;
      this.deserialize();
    }, timeout);
  }

  private startWatch() {
    if (this.mWatch !== undefined) {
      this.mWatch.close();
    }

    if (this.mPluginPath === undefined) {
      return;
    }

    try {
      this.mWatch = fs.watch(this.mPluginPath, {}, (evt, fileName: string) => {
        if (!this.mSerializing && ['loadorder.txt', 'plugins.txt'].indexOf(fileName) !== -1) {
          this.scheduleRefresh(500);
        }
      });
    } catch (err) {
      log('error', 'failed to look for plugin changes', {
        pluginPath: this.mPluginPath, err,
      });
    }
  }

  private stopWatch() {
    if (this.mWatch !== undefined) {
      this.mWatch.close();
      this.mWatch = undefined;
    }
  }
}

export default PluginPersistor;
