import { watch, type FSWatcher } from "node:fs";
import { mkdir, readdir, readFile, stat, utimes, writeFile } from "node:fs/promises";
import * as path from "path";

import { getErrorCode, getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import update from "immutability-helper";

import { log } from "../../../logging";
import type { IErrorOptions, IPersistor } from "../../../types/IExtensionContext";
import { recordErrorSpan } from "../../../util/errorHandling";
import { delayed } from "../../../util/util";
import type { IPluginLoadOrderEntry } from "../types/IPluginLoadOrderEntry";
import {
  gameDataPath,
  gameSupported,
  nativePlugins,
  pluginFormat,
  pluginPath,
} from "../util/gameSupport";
import toPluginId from "../util/toPluginId";
import { definedAttributes } from "./spanAttributes";

export type PluginFormat = "original" | "fallout4";

interface IPluginMap {
  [id: string]: IPluginLoadOrderEntry;
}

const retryCount = 3;

/** How long to wait before another attempt. */
const RETRY_DELAY_MS = 100;

/** How long writes are collected before they go to disk together. */
const SERIALIZE_DELAY_MS = 200;

/**
 * Codes that mean another process holds the file, rather than that the operation is wrong. The
 * same set the elevated file operations retry on (symlink_activator_elevate/remoteCode.ts).
 */
const TRANSIENT_CODES = new Set(["EPERM", "EBUSY", "EIO", "EBADF", "UNKNOWN"]);

/**
 * Runs a file operation, retrying while another process is holding the file. The game, another
 * mod manager or an antivirus scanner all touch these files, so a first failure says little.
 */
export async function withFileRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      if (attempt >= retryCount || !TRANSIENT_CODES.has(getErrorCode(err) ?? "")) {
        throw err;
      }
      await delayed(RETRY_DELAY_MS);
    }
  }
}

/**
 * persistor syncing to and from the gamebryo plugins.txt and loadorder.txt
 *
 * @class PluginPersistor
 * @implements {IPersistor}
 */
class PluginPersistor implements IPersistor {
  private mDataPath: string;
  private mPluginPath: string;
  private mPluginFormat: PluginFormat;
  private mNativePlugins: string[];
  private mGameId: string;
  private mResetCallback: () => PromiseLike<void>;

  private mWatch: FSWatcher;
  private mRefreshTimer: NodeJS.Timeout;
  private mLastWriteTime: Date = new Date();
  private mSerializing: boolean = false;
  private mSerializeScheduled: boolean = false;
  private mSerializeQueue: Promise<void> = Promise.resolve();

  // "dynamic" plugins for which we store a load order (excluding native)
  private mPlugins: IPluginMap;
  // deployed plugins, mapping their plugin id to their file name on disk
  private mKnownPlugins: { [pluginId: string]: string } = {};
  // plugin ids of Blueprint plugins (Starfield-only) — these are managed by
  // the game itself and must not be written to plugins.txt / loadorder.txt.
  private mBlueprintPluginIds: Set<string> = new Set();
  private mInstalledNative: string[] = [];
  private mRetryCounter: number = retryCount;
  private mLoaded: boolean = false;
  private mFailed: boolean = false;
  private mOnError: (message: string, details: Error, options?: IErrorOptions) => void;
  private mControlOrder: () => boolean;
  private mOnExternalChange: () => PromiseLike<"keep" | "revert">;
  private mExternalChoicePending: boolean = false;
  private mRecord: typeof recordErrorSpan;

  constructor(
    onError: (message: string, details: Error, options?: IErrorOptions) => void,
    controlLoadOrder: () => boolean,
    record: typeof recordErrorSpan = recordErrorSpan,
  ) {
    this.mPlugins = {};
    this.mOnError = onError;
    this.mControlOrder = controlLoadOrder;
    this.mRecord = record;
  }

  public disable(): Promise<void> {
    log("debug", "PluginPersistor.disable called");
    return this.enqueue(
      () =>
        new Promise<void>((resolve) => {
          this.mPlugins = {};
          this.mPluginPath = undefined;
          this.mPluginFormat = undefined;
          this.mNativePlugins = undefined;
          this.mLoaded = false;
          this.mExternalChoicePending = false;
          let prom = Promise.resolve();
          if (this.mResetCallback) {
            prom = this.reset();
          }
          prom
            .then(() => {
              this.stopWatch();
              resolve();
            })
            .catch((err: unknown) => {
              log("error", "failed to disable plugin persistor", {
                error: getErrorMessageOrDefault(err),
              });
              this.stopWatch();
              resolve();
            });
        }),
    );
  }

  public loadFiles(gameMode: string): Promise<void> {
    return this.enqueue(() => {
      if (!gameSupported(gameMode)) {
        return Promise.resolve();
      }
      this.mDataPath = gameDataPath(gameMode);
      this.mPluginPath = pluginPath(gameMode);
      this.mPluginFormat = pluginFormat(gameMode);
      this.mNativePlugins = nativePlugins(gameMode);
      this.mGameId = gameMode;
      this.updateNative();
      // ensure that the native plugins are always included
      log("debug", "synching plugins", { pluginsPath: this.mPluginPath });
      // read the files now and update the store
      return (
        this.deserialize()
          // start watching for external changes
          .then(() => {
            this.startWatch();
            void this.serialize();
            return Promise.resolve();
          })
      );
    });
  }

  /**
   * Update the set of known plugins and — atomically — the set of Blueprint
   * plugin ids (Starfield-only). Blueprint plugins are managed by the game
   * itself and must not appear in plugins.txt or loadorder.txt; writing them
   * causes the game to strip them on launch. Passing both in a single call
   * guarantees the serializer never observes a state where known plugins have
   * been updated but the Blueprint filter has not.
   */
  public setKnownPlugins(
    knownPlugins: { [pluginId: string]: string },
    blueprintPluginIds: Set<string> = new Set(),
  ) {
    this.mKnownPlugins = knownPlugins;
    this.mBlueprintPluginIds = blueprintPluginIds;
    this.updateNative();
    void this.serialize();
  }

  public setResetCallback(cb: () => PromiseLike<void>) {
    this.mResetCallback = cb;
  }

  /**
   * Called when a foreign tool/game rewrote the plugin files while Vortex already holds
   * state for the game; resolves the user's decision to keep or revert those changes.
   */
  public setExternalChangeCallback(cb: () => PromiseLike<"keep" | "revert">) {
    this.mOnExternalChange = cb;
  }

  /**
   * Merge the redux loadOrder hive into the persisted plugin state and write it to
   * disk, bypassing the debounced per-key diff pipeline. Merging keeps position memory
   * for plugins the hive does not know (disabled mods); native plugins are never
   * stored. loadOrder is stored relative to the installed native plugins, matching
   * setItem. Errors are swallowed: a rejection would poison the serialize queue.
   */
  public syncFromState(
    gameId: string,
    // keyed by plugin id (toPluginId form)
    loadOrder: Record<string, IPluginLoadOrderEntry>,
  ): Promise<void> {
    return this.enqueue(() => {
      try {
        if (!this.mLoaded || this.mPluginPath === undefined || gameId !== this.mGameId) {
          return Promise.resolve();
        }
        const entries = Object.entries(loadOrder ?? {});
        if (entries.length === 0) {
          // an empty hive means a profile/game activation is mid-flight; syncing it
          // would serialize every plugin as disabled
          return Promise.resolve();
        }
        const nativeSet = new Set(this.mNativePlugins ?? []);
        const next: IPluginMap = { ...this.mPlugins };
        entries.forEach(([pluginId, value]) => {
          if (value == null || nativeSet.has(pluginId)) {
            return;
          }
          next[pluginId] = {
            ...value,
            loadOrder: (value.loadOrder ?? -1) - this.mInstalledNative.length,
          };
        });
        this.mPlugins = next;
        return this.doSerialize();
      } catch (err) {
        // doSerialize reports its own write failures, so reaching here is our own mistake
        this.recordFailure("failed to merge the plugin state", unknownToError(err));
        return Promise.resolve();
      }
    });
  }

  /** An entry as it is stored, before getItem serializes it for the persistor interface. */
  public entry(pluginId: string): IPluginLoadOrderEntry {
    return { ...this.mPlugins[pluginId], loadOrder: this.loadOrder(pluginId) };
  }

  public getItem(key: string[]): Promise<string> {
    if (key.length === 1) {
      // I think right now this branch is always used
      return Promise.resolve(JSON.stringify(this.entry(key[0])));
    } else if (key.length === 2 && key[1] === "loadOrder") {
      // This case doesn't actually seem to occur
      return Promise.resolve(this.loadOrder(key[0]).toString());
    } else {
      const field = key[1] as keyof IPluginLoadOrderEntry;
      return Promise.resolve(JSON.stringify(this.mPlugins[key[0]]?.[field]));
    }
  }

  public setItem(key: string[], value: string): Promise<void> {
    // a whole entry for a one-element key, otherwise that entry's single field
    const newValue = JSON.parse(value) as IPluginLoadOrderEntry & number;
    if (
      key.length > 0 &&
      this.mNativePlugins !== undefined &&
      this.mNativePlugins[key[0]] !== undefined
    ) {
      // ignore native plugins
      return Promise.resolve();
    }

    // loadOrder is stored relative to the installed native plugins. The parsed value is ours
    // alone, so it is adjusted in place.
    if (key.length === 1) {
      newValue.loadOrder -= this.mInstalledNative.length;
    } else if (key.length === 2 && key[1] === "loadOrder") {
      return this.setField(key, newValue - this.mInstalledNative.length);
    }
    if (key.length === 2) {
      return this.setField(key, newValue);
    }
    this.mPlugins = update(this.mPlugins, { [key[0]]: { $set: newValue } });
    return this.serialize();
  }

  /** Stores one field of an entry, which may not exist yet. */
  private setField(key: string[], value: unknown): Promise<void> {
    const field = key[1] as keyof IPluginLoadOrderEntry;
    if (value === this.mPlugins[key[0]]?.[field]) {
      return Promise.resolve();
    }
    this.mPlugins = update(this.mPlugins, {
      [key[0]]: { $apply: (entry?: IPluginLoadOrderEntry) => ({ ...entry, [field]: value }) },
    });
    return this.serialize();
  }

  public removeItem(key: string[]): Promise<void> {
    const entry = this.mPlugins[key[0]];
    if (entry === undefined) {
      return this.serialize();
    }
    if (key.length === 1) {
      this.mPlugins = update(this.mPlugins, { $unset: [key[0]] });
    } else {
      const remaining = update(entry, { $unset: [key[1] as keyof IPluginLoadOrderEntry] });
      // an entry with no fields left is the entry being gone
      this.mPlugins =
        Object.keys(remaining).length === 0
          ? update(this.mPlugins, { $unset: [key[0]] })
          : update(this.mPlugins, { [key[0]]: { $set: remaining } });
    }
    return this.serialize();
  }

  public getAllKeys(): Promise<string[][]> {
    return Promise.resolve(Object.keys(this.mKnownPlugins || {}).map((key) => [key]));
  }

  /**
   * Tells the user a plugin file operation failed, once until one succeeds, and tells telemetry
   * every time. The two are separate decisions: a failure we do not interrupt the user with is
   * still worth knowing about, and recordErrorSpan drops the ones caused by their environment.
   */
  private reportError(message: string, detail: Error, options?: IErrorOptions) {
    if (this.mFailed) {
      // the user has already been told, but a failure that keeps happening is still news to us,
      // unless the caller judged it to be the user's environment rather than our doing
      if (options?.allowReport !== false) {
        this.recordFailure(message, detail);
      }
      return;
    }
    this.mFailed = true;
    // showErrorNotification logs and records the span itself
    this.mOnError(message, detail, options);
  }

  /** Forwards a failure of our own to telemetry. */
  private recordFailure(message: string, detail: Error) {
    log("error", message, { error: getErrorMessageOrDefault(detail) });
    this.mRecord(
      message,
      detail,
      definedAttributes({ "error.code": getErrorCode(detail) ?? undefined }),
    );
  }

  private toPluginList(input: string[]) {
    if (this.mPluginFormat === "original") {
      return this.toPluginListOriginal(input);
    } else {
      return this.toPluginListFallout4(input);
    }
  }

  private updateNative() {
    const previous = this.mInstalledNative;
    if (this.mKnownPlugins === undefined) {
      this.mInstalledNative = [];
    }
    this.mInstalledNative = (this.mNativePlugins || []).filter(
      (iter) => this.mKnownPlugins[iter] !== undefined,
    );
    const changed =
      previous.length !== this.mInstalledNative.length ||
      this.mInstalledNative.some((iter, idx) => previous[idx] !== iter);
    if (changed && this.mResetCallback) {
      void this.reset();
    }
  }

  private toPluginListOriginal(input: string[]) {
    // enabled defaults to true for native plugins because they are always
    // enabled
    const nativePluginSet = new Set(this.mNativePlugins);
    return input.filter((name) => {
      if (nativePluginSet.has(name.toLowerCase())) {
        return true;
      }
      // a ghosted plugin still holds its place in the order
      const enabled = this.mPlugins[name.toLowerCase()]?.enabled;
      return enabled === true || enabled === "ghost";
    });
  }

  private toPluginListFallout4(input: string[]) {
    // LOOT and previous versions of Vortex don't store native plugins so
    // this has been handled this way for a while
    const nativePluginSet = new Set(this.mNativePlugins);
    return (
      input
        .filter((name) => !nativePluginSet.has(name.toLowerCase()))
        // only a plugin that is actually on gets the active marker; ghosted ones stay bare
        .map((name) => (this.mPlugins[name.toLowerCase()]?.enabled === true ? "*" + name : name))
    );
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
    if (this.mExternalChoicePending) {
      // don't serialize while the user is deciding whether to keep or revert a foreign rewrite
      return Promise.resolve();
    }
    if (!this.mSerializeScheduled) {
      this.mSerializeScheduled = true;
      // ensure we don't try to concurrently write the files
      void this.enqueue(async () => {
        await delayed(SERIALIZE_DELAY_MS);
        try {
          await this.doSerialize();
        } catch (err) {
          // a write failure is already reported, so this is our own mistake
          this.recordFailure("failed to serialize plugin list", unknownToError(err));
        }
      });
    }
    return Promise.resolve();
  }

  private loadOrder(pluginId: string): number {
    const nativeIdx = this.mInstalledNative.indexOf(pluginId);
    if (nativeIdx !== -1) {
      return nativeIdx;
    }
    if (this.mPlugins[pluginId] === undefined) {
      return -1;
    }
    return this.mPlugins[pluginId].loadOrder + this.mInstalledNative.length;
  }

  private doSerialize(): Promise<void> {
    if (this.mPluginPath === undefined || this.mDataPath === undefined) {
      return Promise.resolve();
    }
    if (this.mKnownPlugins === undefined) {
      return Promise.resolve();
    }
    const destPath = this.mPluginPath;

    this.mSerializing = true;
    this.mSerializeScheduled = false;

    // we need a list that includes all deployed plugins and only those,
    // sorted by their load order
    // this includes native plugins, which may be filtered out later, depending on the game
    // Blueprint plugins (Starfield) are excluded entirely: the game manages them
    // itself and strips any that appear in plugins.txt / loadorder.txt on launch.
    const sorted: string[] = Object.keys(this.mKnownPlugins)
      .filter((pluginId) => !this.mBlueprintPluginIds.has(pluginId))
      .sort((lhs: string, rhs: string) => this.loadOrder(lhs) - this.loadOrder(rhs))
      .filter((pluginId) => pluginId !== undefined)
      .map((pluginId) => this.mKnownPlugins[pluginId]);

    const pluginsFile = path.join(destPath, "plugins.txt");
    return this.writeFiles(destPath, sorted)
      .then((writtenAt) => {
        this.mFailed = false;
        this.mLastWriteTime = writtenAt;
      })
      .catch((err: unknown) => {
        const code = getErrorCode(err);
        if (code === "EBUSY") {
          // the file is held by another process, quite possibly the game itself
          return;
        }
        // Disallow error reports for:
        //  - Permissions related issues
        //  - Missing plugins.txt file as we're literally creating/writing
        //    to it at the beginning of this chain; if it's missing that's
        //    guaranteed to be due to an external application removing it (AV or something else).
        const missingPluginsFile =
          code === "ENOENT" && (err as { path?: string }).path === pluginsFile;
        const allowReport = code !== "EPERM" && !missingPluginsFile;
        this.reportError("failed to write plugin list", unknownToError(err), { allowReport });
      })
      .finally(() => {
        this.mSerializing = false;
      });
  }

  /**
   * Writes both list files, then stamps the plugins so the game reads them in this order.
   * Resolves with the time plugins.txt was written.
   */
  private async writeFiles(destPath: string, sorted: string[]): Promise<Date> {
    const loadOrderFile = path.join(destPath, "loadorder.txt");
    const pluginsFile = path.join(destPath, "plugins.txt");
    // this mkdir should not be necessary
    await mkdir(destPath, { recursive: true });
    await withFileRetry(() =>
      writeFile(loadOrderFile, "# Automatically generated by Vortex\r\n" + sorted.join("\r\n"), {
        encoding: "utf8",
      }),
    );
    const filtered: string[] = this.toPluginList(sorted);
    await withFileRetry(() =>
      writeFile(
        pluginsFile,
        "# Automatically generated by Vortex\r\n" + filtered.join("\r\n") + "\r\n",
        { encoding: "latin1" },
      ),
    );

    if (this.mPluginFormat === "original" && this.mControlOrder()) {
      const offset = 946684800;
      const oneDay = 24 * 60 * 60;
      for (const [idx, fileName] of sorted.entries()) {
        const mtime = offset + oneDay * idx;
        try {
          await withFileRetry(() => utimes(path.join(this.mDataPath, fileName), mtime, mtime));
        } catch (err) {
          // a plugin listed for a file that is no longer deployed
          if (getErrorCode(err) !== "ENOENT") {
            throw err;
          }
        }
      }
    }

    return (await withFileRetry(() => stat(pluginsFile))).mtime;
  }

  private filterFileData(
    input: string,
    plugins: boolean,
    foreign?: { detected: boolean },
  ): string[] {
    const lines = input.split(/\r?\n/);

    if (lines.length === 0 || lines[0].indexOf("generated by Vortex") === -1) {
      const header =
        lines.length === 0 || !lines[0].startsWith("#") ? "<empty>" : lines[0].slice(1).trim();
      if (foreign !== undefined) {
        foreign.detected = true;
      }
      log("info", "plugins file was changed by foreign application", {
        header,
        pluginstxt: plugins,
      });
    }

    const res = lines.filter((value: string) => {
      return !value.startsWith("#") && value.length > 0;
    });

    return res;
  }

  private initFromKeyList(plugins: IPluginMap, keys: string[], enable: boolean, offset: number) {
    // plugins identifies files actually on disk, keys is from loadorder.txt or plugins.txt, can't
    // be sure if those files actually exist on disk, could be outdated

    let loadOrderPos = offset;
    const nativePluginSet = new Set<string>(this.mNativePlugins);
    // eliminate duplicates
    const transformedKeys = Array.from(new Set(keys.map((key) => key.toLowerCase())));
    transformedKeys.forEach((key: string) => {
      const keyEnabled = enable && (this.mPluginFormat === "original" || key[0] === "*");
      if (this.mPluginFormat === "fallout4" && key[0] === "*") {
        key = key.slice(1);
      }
      // ignore native plugins in all games (we have those in the list of "known" plugins but
      // for the load order we only store the "dynamic" plugins)
      if (nativePluginSet.has(key)) {
        return;
      }
      // ignore files that don't exist on disk
      if (plugins[key] === undefined) {
        plugins[key] = {
          enabled: false,
          loadOrder: -1,
        };
      }

      plugins[key].enabled = keyEnabled || nativePluginSet.has(key);
      if (plugins[key].loadOrder === -1) {
        plugins[key].loadOrder = loadOrderPos++;
      }
    });
    return loadOrderPos;
  }

  /**
   * For the old format where Vortex does not control the order, the game reads it off the file
   * times, so the plugins are ordered by when they were last written.
   */
  private async orderByFileTime(newPlugins: IPluginMap): Promise<void> {
    if (this.mPluginFormat !== "original" || this.mControlOrder() || this.mGameId === "skyrim") {
      return;
    }
    const deployed = (await withFileRetry(() => readdir(this.mDataPath))).filter(
      (fileName) => newPlugins[toPluginId(fileName)] !== undefined,
    );
    const entries = await Promise.all(
      deployed.map(async (fileName) => ({
        fileName,
        fileTime: (await stat(path.join(this.mDataPath, fileName))).mtimeMs,
      })),
    );
    entries
      .sort((lhs, rhs) => lhs.fileTime - rhs.fileTime)
      .forEach((entry, idx) => {
        newPlugins[toPluginId(entry.fileName)].loadOrder = idx;
      });
  }

  private deserialize(retry: boolean = false, adoptForeign: boolean = false): Promise<void> {
    if (this.mPluginPath === undefined) {
      return Promise.resolve();
    }

    if (this.mExternalChoicePending && !adoptForeign) {
      return Promise.resolve();
    }

    const foreign = { detected: false };

    let offset = 0;

    const pluginsFile = path.join(this.mPluginPath, "plugins.txt");

    const newPlugins: IPluginMap = {};

    let phaseOne: Promise<Buffer>;
    // for games with the old format we use the loadorder.txt file as reference for the
    // load order and only use the plugins.txt as "backup".
    // for newer games, since all plugins are listed, we don't really need the loadorder.txt
    // at all
    if (this.mPluginFormat === "original") {
      const loadOrderFile = path.join(this.mPluginPath, "loadorder.txt");
      log("debug", "deserialize", {
        format: this.mPluginFormat,
        pluginsFile,
        loadOrderFile,
      });
      phaseOne = withFileRetry(() => readFile(loadOrderFile)).then((data: Buffer) => {
        const keys: string[] = this.filterFileData(data.toString("utf-8"), false, foreign);
        offset = this.initFromKeyList(newPlugins, keys, false, offset);
        return withFileRetry(() => readFile(pluginsFile));
      });
    } else {
      // log('debug', 'deserialize', { format: this.mPluginFormat, pluginsFile });
      phaseOne = withFileRetry(() => readFile(pluginsFile));
    }
    return phaseOne
      .then((data: Buffer) => {
        if (data.length === 0) {
          // not even a header? I don't trust this. Read once more in case we caught a write
          // mid-flight, then leave the current state alone: a truncated file is not a
          if (retry) {
            // The persistor must still count as loaded, or serialize() drops every write
            this.mLoaded = true;
            return Promise.resolve();
          }
          return this.deserialize(true, adoptForeign);
        }
        const keys: string[] = this.filterFileData(data.toString("latin1"), true, foreign);
        this.initFromKeyList(newPlugins, keys, true, offset);

        return this.orderByFileTime(newPlugins).then(() => {
          if (
            foreign.detected &&
            !adoptForeign &&
            this.mLoaded &&
            this.mOnExternalChange !== undefined
          ) {
            // a foreign rewrite while Vortex holds state for this game: the user decides
            this.promptExternalChange();
            return Promise.resolve();
          }
          this.adoptParsed(newPlugins);
          return Promise.resolve();
        });
      })
      .catch((err: unknown) => {
        if (getErrorCode(err) === "ENOENT") {
          this.mLoaded = true;
          return;
        }
        log("warn", "failed to read plugin file", {
          pluginPath: this.mPluginPath,
          error: getErrorMessageOrDefault(err),
        });
        if (this.mRetryCounter > 0) {
          --this.mRetryCounter;
          this.scheduleRefresh(100);
        } else {
          // giving up...
          this.mLoaded = true;
          this.reportError("failed to read plugin list", unknownToError(err));
        }
      });
  }

  private scheduleRefresh(timeout: number) {
    if (this.mRefreshTimer !== null) {
      clearTimeout(this.mRefreshTimer);
    }
    this.mRefreshTimer = setTimeout(() => {
      this.mRefreshTimer = null;
      this.deserialize()
        .then(() => null)
        .catch((err: unknown) => {
          this.mOnError("Failed to synchronise plugin list", unknownToError(err));
        });
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
      this.mWatch = watch(this.mPluginPath, {}, (_evt, fileName) => {
        if (
          !this.mSerializing &&
          fileName !== null &&
          ["loadorder.txt", "plugins.txt"].includes(fileName) &&
          this.mPluginPath !== undefined
        ) {
          withFileRetry(() => stat(path.join(this.mPluginPath, fileName)))
            .then((stats) => {
              if (stats.mtime > this.mLastWriteTime) {
                this.scheduleRefresh(500);
              }
            })
            .catch((err: unknown) => {
              const code = getErrorCode(err);
              if (code === "ENOENT") {
                return;
              }
              this.mOnError(`failed to read "${fileName}"`, unknownToError(err), {
                allowReport: code !== "EPERM",
              });
            });
        }
      });
      // the watched directory going away is the game being moved or uninstalled, not our doing
      this.mWatch.on("error", (error: unknown) => {
        log("warn", "failed to watch plugin directory", {
          pluginPath: this.mPluginPath,
          error: getErrorMessageOrDefault(error),
        });
      });
    } catch (err) {
      log("error", "failed to look for plugin changes", {
        pluginPath: this.mPluginPath,
        error: getErrorMessageOrDefault(err),
      });
    }
  }

  private stopWatch() {
    if (this.mWatch !== undefined) {
      this.mWatch.close();
      this.mWatch = undefined;
    }
  }

  private reset(): Promise<void> {
    return Promise.resolve(this.mResetCallback())
      .then(() => {
        this.mRetryCounter = retryCount;
      })
      .catch((err: unknown) => {
        this.reportError("failed to reset load order info", unknownToError(err));
      });
  }

  private adoptParsed(newPlugins: IPluginMap) {
    this.mPlugins = newPlugins;
    this.mLoaded = true;
    if (this.mResetCallback) {
      // reset() owns the retry counter and reports hydration failures
      void this.reset();
    }
    this.mFailed = false;
  }

  /**
   * Ask the user whether to keep or revert a foreign rewrite of the plugin files. Runs
   * detached from the serialize queue (a pending dialog must not block writes); bursts
   * of change events collapse into the one open prompt. Keep re-parses the file at
   * decision time; until then Vortex's own state stays authoritative.
   */
  private promptExternalChange() {
    if (this.mExternalChoicePending) {
      return;
    }
    this.mExternalChoicePending = true;
    Promise.resolve(this.mOnExternalChange())
      .then((choice) => {
        this.mExternalChoicePending = false;
        if (choice === "keep") {
          return this.deserialize(false, true);
        }
        // revert: rewrite the files from Vortex's own state
        return this.enqueue(() =>
          this.doSerialize().catch((err) => {
            log("error", "failed to revert external plugin file change", {
              error: getErrorMessageOrDefault(err),
            });
          }),
        );
      })
      .catch((err) => {
        this.mExternalChoicePending = false;
        log("warn", "failed to resolve external plugin file change", {
          error: getErrorMessageOrDefault(err),
        });
      });
  }
}

export default PluginPersistor;
