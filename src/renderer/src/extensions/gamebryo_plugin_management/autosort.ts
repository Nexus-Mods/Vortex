import { stat } from "node:fs/promises";
import * as path from "path";

import { getErrorMessageOrDefault, parseError } from "@vortex/shared";
import { ProcessCanceled, UserCanceled, VortexError } from "@vortex/shared/errors";
import Bluebird from "bluebird";
import { pl } from "date-fns/locale";
import getVersion from "exe-version";
import type i18next from "i18next";
import type { Message, PluginMetadata } from "loot";
import {} from "redux-thunk";

import { startActivity, stopActivity } from "../../actions/session";
import { log } from "../../logging";
import type { ICheckbox, IDialogAction } from "../../types/IDialog";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { fileMD5 } from "../../util/checksum";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch } from "../../util/util";
import { webpackRequireHack } from "../../util/webpack-hacks";
import { currentGameDiscovery, discoveryByGame } from "../gamemode_management/selectors";
import { clearPendingPluginSort } from "../mod_management/actions/transactions";
import { activeGameId, activeProfile } from "../profile_management/selectors";
/* eslint-disable */
import { updatePluginOrder } from "./actions/loadOrder";
import { removeGroupRule, removeRule, setGroup } from "./actions/userlist";
import { GHOST_EXT, NAMESPACE } from "./statics";
import { EdgeType } from "./types/ILoot";
import type { ICycleEdge, ILootProm, ILootRef, ILootStaticProm } from "./types/ILoot";
import { IPluginLoot, IPlugins, IPluginsLoot } from "./types/IPlugins";
import { findInvalidPlugins } from "./util/findInvalidPlugins";
import { gameDataPath, gameSupported, nativePlugins, pluginPath } from "./util/gameSupport";
import { missingGroupFixes } from "./util/groups";
import { lootErrorReporter, LootPhase } from "./util/LootErrorReporter";
import { toLootError } from "./util/lootErrors";
import { downloadMasterlist, downloadPrelude } from "./util/masterlist";
import { listPaths, MetadataLists } from "./util/metadataLists";
import { explainMasterNotLoaded } from "./util/missingMasters";
import { SpanAttribute } from "./util/spanAttributes";
import toPluginId from "./util/toPluginId";

const MAX_RESTARTS = 3;

const basename = (filePath: string) => path.basename(filePath);

/** How a sort attempt ended; only "sorted" changed the load order. */
type SortOutcome =
  | { result: "sorted"; sorted: string[] }
  | { result: "deferred" | "skipped" | "nothing-to-sort" | "interrupted" }
  | { result: "failed"; error: VortexError };

const failed = (error: VortexError): SortOutcome => ({ result: "failed", error });

// A CJS module at a runtime path has to come in through the raw node require,
// the renderer's own import() resolves through the browser loader, which cannot load it.
let LootProm: ILootStaticProm | undefined;
function getLootProm(): ILootStaticProm {
  if (LootProm === undefined) {
    const lootModule = webpackRequireHack(
      path.join(getVortexPath("assets_unpacked"), "loot", "index.js"),
    ) as typeof import("loot");
    LootProm = Bluebird.promisifyAll(lootModule.LootAsync) as unknown as ILootStaticProm;
  }
  return LootProm;
}

// Single actionable warning for plugins LOOT could not parse (corrupt/invalid) and that were
// skipped so the rest could load and sort. The plugin list can be long, so the notification keeps a
// short message and puts the offending names behind a "More" dialog. Shared by the load and sort
// recovery paths.
function reportSkippedInvalidPlugins(api: IExtensionApi, plugins: string[]): void {
  const t = api.translate;
  api.sendNotification({
    id: "loot-skipped-invalid-plugins",
    type: "warning",
    message: "Some plugins are invalid and were skipped",
    actions: [
      {
        title: "More",
        action: (dismiss: () => void) => {
          api
            .showDialog(
              "info",
              "Invalid plugins skipped",
              {
                text: t(
                  "These plugins could not be parsed by LOOT and were skipped so the rest of your " +
                    "load order could still sort. Reinstall or remove them to fix it:",
                  { ns: NAMESPACE },
                ),
                message: plugins.join("\n"),
              },
              [{ label: "Close" }],
            )
            .then(() => dismiss());
        },
      },
    ],
  });
}

class LootInterface {
  private mExtensionApi: IExtensionApi;
  private mInitPromise: Bluebird<ILootRef> = Bluebird.resolve({
    game: undefined,
    loot: undefined,
  });
  private mSortPromise: Promise<string[]> = Promise.resolve([]);

  private mLists = new MetadataLists();
  // with the game it belongs to, so a download finishing after a game switch cannot load into it
  private mLoot: { game: string; loot: ILootProm } | undefined;
  private mRestarts: number = MAX_RESTARTS;
  // a sort requested while an activity blocked it, run once the activity ends
  private mDeferredSort: { manual: boolean } | undefined;

  constructor(api: IExtensionApi) {
    const store = api.store;

    this.mExtensionApi = api;

    // when the game changes, we need to re-initialize loot for that game
    api.events.on("gamemode-activated", (gameMode) => this.onGameModeChanged(api, gameMode));

    {
      // in case the initial gamemode-activated event was already sent,
      // initialize right away
      const gameMode = activeGameId(store.getState());
      if (gameMode) {
        this.onGameModeChanged(api, gameMode);
      }
    }

    api.events.on("restart-helpers", async () => {
      const { game, loot } = await this.mInitPromise;
      const gameMode = activeGameId(store.getState());
      this.startStopLoot(gameMode, loot);
    });

    // on demand, re-sort the plugin list
    api.events.on("autosort-plugins", this.onSort);
    api.onStateChange(["session", "base", "activity"], this.runDeferredSort);

    api.events.on(
      "plugin-details",
      (gameId: string, plugins: string[], callback: (result: IPluginsLoot) => void) =>
        this.pluginDetails(api, gameId, plugins, callback),
    );
  }

  public async downloadMasterlist(gameMode: string): Promise<void> {
    const paths = listPaths(getVortexPath("userData"), gameMode);
    try {
      await downloadPrelude(paths.prelude);
      await downloadMasterlist(this.convertGameId(gameMode, true), paths.masterlist);
      log("info", "updated loot masterlist");
      this.mExtensionApi.events.emit("did-update-masterlist");
      // the file time cannot tell a re-download from the masterlist already loaded
      this.mLists.invalidate();
      const current = this.mLoot;
      if (current?.game === gameMode && !current.loot.isClosed()) {
        await this.ensureLists(gameMode, current.loot);
      }
    } catch (err) {
      const t = this.mExtensionApi.translate;
      this.mExtensionApi.showErrorNotification(
        "Failed to update masterlist",
        {
          message: t(
            "This might be a temporary network error. " +
              'If it persists, please delete "{{masterlistPath}}" to force Vortex to ' +
              "download a new copy.",
            { replace: { masterlistPath: path.dirname(paths.masterlist) } },
          ),
          error: err,
        },
        {
          allowReport: false,
        },
      );
    }
  }

  public async wait(): Promise<void> {
    try {
      await this.mInitPromise;
      await this.mSortPromise;
    } catch (err) {
      // nop
    }
  }

  private shouldDeferLootActivities = () => {
    const state = this.mExtensionApi.store.getState();
    const deferOnActivities = ["installing_dependencies", "mods"];
    const isActivityRunning = (activity: string) =>
      getSafe(state, ["session", "base", "activity", activity], []).length > 0;
    const deferActivities = deferOnActivities.filter((activity) => isActivityRunning(activity));
    return deferActivities.length > 0;
  };

  private runDeferredSort = () => {
    if (this.mDeferredSort === undefined || this.shouldDeferLootActivities()) {
      return;
    }
    const { manual } = this.mDeferredSort;
    this.mDeferredSort = undefined;
    void this.onSort(manual);
  };

  private onSort = async (manual: boolean, callback?: (err: Error) => void) => {
    const outcome = await this.runSort(manual);
    if (outcome.result === "sorted") {
      this.mExtensionApi.sendNotification({
        id: "loot-sorted",
        type: "success",
        message: "LOOT sorting successful",
        displayMS: 3000,
      });
    }
    if (callback !== undefined) {
      callback(outcome.result === "failed" ? outcome.error : null);
    }
  };

  /**
   * Sorts exactly the given plugin files, for the lootSortAsync extension API, and resolves with
   * their names in the order libloot chose. A sort that did not run rejects: the caller writes the
   * answer to its plugins file, so an unsorted list must never pass as one.
   */
  public async sortFiles(pluginFilePaths: string[]): Promise<string[]> {
    const outcome = await this.runSort(true, pluginFilePaths);
    switch (outcome.result) {
      case "sorted":
        return outcome.sorted;
      case "nothing-to-sort":
        return [];
      case "failed":
        throw outcome.error;
      case "deferred":
        throw new VortexError("a mod operation is running, sort again once it finishes", {
          kind: "process-canceled",
        });
      case "skipped":
      case "interrupted":
        throw new VortexError("LOOT stopped before the sort finished", {
          kind: "process-canceled",
        });
    }
  }

  /** The gates every sort passes before doSort; the API path supplies the files to sort. */
  private async runSort(manual: boolean, pluginFilePaths?: string[]): Promise<SortOutcome> {
    const { store } = this.mExtensionApi;
    if (this.shouldDeferLootActivities()) {
      // only a state sort can run later from the deferred slot: it holds no file list and no
      // caller to answer, so a file sort is refused instead
      if (pluginFilePaths === undefined) {
        // a manual request stays manual so the deferred run is not gated by the autoSort setting
        this.mDeferredSort = { manual: manual || (this.mDeferredSort?.manual ?? false) };
      }
      return { result: "deferred" };
    }
    if (!manual && !store.getState().settings.plugins.autoSort) {
      return { result: "skipped" };
    }
    try {
      // ensure initialisation is done
      const { game, loot } = await this.mInitPromise;
      const gameMode = activeGameId(store.getState());
      if (gameMode !== game) {
        // a game switch is tearing this instance down; the new game's activation sorts again
        return failed(
          new VortexError("LOOT is initializing for a different game", {
            kind: "process-canceled",
          }),
        );
      }
      if (!gameSupported(gameMode, true)) {
        return failed(
          new VortexError("plugin sorting is not supported for this game", {
            kind: "not-supported",
            feature: "plugin sorting",
          }),
        );
      }
      if (loot === undefined || loot.isClosed()) {
        return failed(new VortexError("LOOT is uninitialized/closed", { kind: "loot:failed" }));
      }
      // ensure no other sort is in progress
      try {
        await this.mSortPromise;
      } catch {
        // the previous sort reported its own failure
      }
      const filePaths = await this.sortInput(pluginFilePaths);
      return await this.doSort(filePaths, gameMode, loot);
    } catch (err) {
      // doSort classifies libloot's own failures; anything reaching here failed before the call
      return failed(parseError(err));
    }
  }

  /**
   * The plugin files to hand libloot in their current load order, which is libloot's tie-break;
   * plugins the load order does not know yet rank last, like a plugin the game has not seen
   * before. Only files that exist on disk: the given files, or the deployed non-ghost plugins
   * plus the natives from the plugin list.
   */
  private async sortInput(pluginFilePaths?: string[]): Promise<string[]> {
    const state = this.mExtensionApi.store.getState();
    const ranks = new Map<string, number>();
    const rank = (filePath: string) => {
      let value = ranks.get(filePath);
      if (value === undefined) {
        value = state.loadOrder[toPluginId(filePath)]?.loadOrder ?? Number.MAX_SAFE_INTEGER;
        ranks.set(filePath, value);
      }
      return value;
    };
    const byRank = (lhs: string, rhs: string) => rank(lhs) - rank(rhs);
    let filePaths: string[];
    if (pluginFilePaths !== undefined) {
      filePaths = [...pluginFilePaths].sort(byRank);
    } else {
      const pluginList: IPlugins = state.session.plugins.pluginList;
      const isValid = (pluginKey: string) => {
        const isDeployed = pluginList[pluginKey]?.deployed || false;
        const isGhost =
          pluginList[pluginKey]?.filePath &&
          path.extname(pluginList[pluginKey]?.filePath) === GHOST_EXT;
        const isNative = pluginList[pluginKey]?.isNative || false;
        return (isDeployed && !isGhost) || isNative;
      };
      filePaths = Object.keys(pluginList)
        .filter(isValid)
        .map((pluginId) => pluginList[pluginId].filePath)
        .sort(byRank);
    }
    // loot produces really annoying error messages for files that are not there
    const existing = await Promise.all(
      filePaths.map((filePath) =>
        stat(filePath)
          .then(() => filePath)
          .catch(() => undefined),
      ),
    );
    return existing.filter((filePath): filePath is string => filePath !== undefined);
  }

  /**
   * The LOOT application's pre-sort sequence: refresh the load-order state, hold the game's main
   * master headers-only, fully load everything else being sorted. The master is resolved from the
   * Data folder so a Starfield batch is valid even when the caller did not list it.
   */
  private async loadForSort(gameMode: string, loot: ILootProm, filePaths: string[]): Promise<void> {
    await loot.loadCurrentLoadOrderStateAsync();
    // the game's own master file is the first plugin in its hardcoded load order
    const mainMaster = nativePlugins(gameMode)[0];
    const isMainMaster = (filePath: string) => toPluginId(filePath) === mainMaster;
    if (mainMaster !== undefined && (await loot.getPluginAsync(mainMaster)) === undefined) {
      const pluginList: IPlugins = this.mExtensionApi.store.getState().session.plugins.pluginList;
      const masterPath =
        filePaths.find(isMainMaster) ??
        pluginList?.[mainMaster]?.filePath ??
        path.join(gameDataPath(gameMode), mainMaster);
      if (
        await stat(masterPath).then(
          () => true,
          () => false,
        )
      ) {
        await loot.loadPluginsAsync([masterPath], true);
      }
    }
    const others = filePaths.filter((filePath) => !isMainMaster(filePath));
    if (others.length > 0) {
      await loot.loadPluginsAsync(others, false);
    }
  }

  private get gamePath() {
    const { store } = this.mExtensionApi;
    const discovery = currentGameDiscovery(store.getState());
    if (discovery === undefined) {
      // no game selected
      return undefined;
    }
    return discovery.path;
  }

  private get dataPath() {
    const { store } = this.mExtensionApi;
    const gameId = activeGameId(store.getState());
    const discovery = discoveryByGame(store.getState(), gameId);
    if (!discovery?.path) {
      // no game selected
      return undefined;
    }

    return gameDataPath(gameId);
  }

  private async doSort(
    filePaths: string[],
    gameMode: string,
    loot: ILootProm,
    excluded: string[] = [],
  ): Promise<SortOutcome> {
    const { store } = this.mExtensionApi;
    // Exclude every invalid plugin in one header-parse pass before sorting. sortPlugins is handed
    // the full state-built list, so a plugin libloot couldn't load would throw PluginNotLoaded;
    // pre-filtering avoids re-running the whole sort once per bad plugin.
    const pluginList: IPlugins = store.getState().session.plugins.pluginList ?? {};
    let pluginNames = filePaths.map(basename);
    const invalid = await findInvalidPlugins(pluginNames, pluginList, gameMode);
    if (invalid.size > 0) {
      excluded = [...excluded, ...pluginNames.filter((id) => invalid.has(id))];
      filePaths = filePaths.filter((filePath) => !invalid.has(basename(filePath)));
      pluginNames = filePaths.map(basename);
      log("warn", "excluding invalid plugins from sort", { plugins: [...invalid] });
    }
    try {
      this.mExtensionApi.dismissNotification("loot-cycle-warning");
      const timeBefore = Date.now();
      store.dispatch(startActivity("plugins", "sorting"));
      this.mSortPromise = this.ensureLists(gameMode, loot)
        .then(() => this.loadForSort(gameMode, loot, filePaths))
        .then(() => loot.sortPluginsAsync(pluginNames))
        .catch((err: unknown) =>
          getErrorMessageOrDefault(err).toLowerCase() === "already closed"
            ? Promise.resolve([])
            : Promise.reject(err),
        );
      const sorted: string[] = await this.mSortPromise;
      this.mRestarts = MAX_RESTARTS;
      const state = store.getState();
      if (sorted === undefined) {
        // loot return an undefined result? how?
        log("error", "failed to sort plugins, empty loot result");
        return failed(new VortexError("LOOT returned no result", { kind: "loot:failed" }));
      }
      store.dispatch(updatePluginOrder(sorted, false, state.settings.plugins.autoEnable));
      log("debug", "sorting plugins finished", {
        elapsedMS: Date.now() - timeBefore,
      });
      if (excluded.length > 0) {
        reportSkippedInvalidPlugins(this.mExtensionApi, excluded);
      }
      if (pluginNames.length === 0) {
        // nothing was sorted, so the durable "sort owed" marker stays until a real sort happens
        log("warn", "nothing to sort", { gameMode, excluded: excluded.length });
        return { result: "nothing-to-sort" };
      }
      if (sorted.length === 0) {
        // the 'already closed' catch above resolves to [] when LOOT closed mid-sort; the marker
        // stays so the sort is retried on the next activation of the profile
        return { result: "interrupted" };
      }
      const sortedProfileId = activeProfile(state)?.id;
      if (sortedProfileId !== undefined) {
        store.dispatch(clearPendingPluginSort(sortedProfileId));
      }
      lootErrorReporter.succeeded(LootPhase.Sort);
      return { result: "sorted", sorted };
    } catch (rawErr) {
      const err = toLootError(rawErr);
      log("info", "loot failed", { kind: err.data.kind, error: err.message });
      switch (err.data.kind) {
        case "loot:cyclic-interaction":
          this.reportCycle(err.data.cycle, loot);
          break;
        // invalid plugins are excluded by header parse before sorting, so reaching here means
        // libloot rejected a plugin ESPFile considered valid
        case "loot:invalid-plugin":
          lootErrorReporter.report(this.mExtensionApi, err, LootPhase.Sort);
          break;
        case "loot:master-not-loaded": {
          // which master is missing, and why, is more than the kind alone can say
          const failure = await explainMasterNotLoaded(
            this.mExtensionApi,
            gameMode,
            err.data.master,
          );
          lootErrorReporter.report(this.mExtensionApi, err, LootPhase.Sort, { failure });
          break;
        }
        case "loot:missing-group": {
          // A collection (or the user) assigned plugins to a LOOT group that no longer exists -
          // typically a masterlist group that was renamed or removed after the collection was
          // authored. Rather than failing the entire sort, drop every dangling reference (the
          // master-/userlist groups are in state) so the affected plugins fall back to their
          // default group, then re-sort. If there's nothing to reset we can't recover this way,
          // so just notify.
          const { missing, actions } = missingGroupFixes(store.getState());
          if (actions.length > 0) {
            log("info", "resetting plugins assigned to missing loot group(s)", { missing });
            batchDispatch(store, actions);
            // read the rewritten userlist again, once the persistor has flushed it
            this.mLists.invalidate();
            await new Promise((resolve) => setTimeout(resolve, 500));
            return this.doSort(filePaths, gameMode, loot);
          }
          lootErrorReporter.report(this.mExtensionApi, err, LootPhase.Sort);
          break;
        }
        case "loot:condition-failed":
          if (err.data.executable !== undefined) {
            let exists = false;
            let fileSize = 0;
            let md5sum = "";
            let version = "";
            const filePath = path.resolve(this.dataPath, err.data.executable);

            const report = () => {
              err.message +=
                "\n\nThis error is usually caused by pirated copies of the game. " +
                "If this is definitively not the case for you (and only then!), " +
                "please report it.";
              this.mExtensionApi.showErrorNotification(
                "LOOT operation failed",
                {
                  error: err,
                  File: filePath,
                  Exists: exists,
                  Size: fileSize,
                  MD5: md5sum,
                  Version: version,
                },
                {
                  id: "loot-failed",
                  allowReport: false,
                },
              );
            };

            try {
              const stats = fs.statSync(filePath);
              exists = true;
              fileSize = stats.size;
              version = getVersion(filePath) || "unknown";
              fileMD5(filePath)
                .then((hash) => (md5sum = hash))
                .catch(() => null)
                .finally(() => {
                  report();
                });
            } catch (err) {
              report();
            }
          } else {
            lootErrorReporter.report(this.mExtensionApi, err, LootPhase.Sort);
          }
          break;
        case "process-canceled":
          // the loot instance was closed underneath the call, the result is not needed anyway
          return { result: "interrupted" };
        default:
          lootErrorReporter.report(this.mExtensionApi, err, LootPhase.Sort);
          break;
      }
      return failed(err);
    } finally {
      store.dispatch(stopActivity("plugins", "sorting"));
    }
  }

  private onGameModeChanged = async (api: IExtensionApi, gameMode: string) => {
    const oldInitProm = this.mInitPromise;

    let onRes: (x: ILootRef) => void;

    this.mInitPromise = new Bluebird<ILootRef>((resolve) => {
      onRes = resolve;
    });

    const { game, loot }: ILootRef = await oldInitProm;
    if (gameMode === game) {
      this.mInitPromise = oldInitProm;
      onRes({ game, loot });
      // no change
      return;
    } else {
      this.startStopLoot(gameMode, loot);
      onRes(await this.mInitPromise);
    }
  };

  private startStopLoot(gameMode: string, loot: ILootProm | undefined) {
    this.mLoot = undefined;
    if (loot !== undefined) {
      // close the loot instance of the old game, but give it a little time, otherwise it may try to
      // to run instructions after being closed.
      // TODO: Would be nice if this was deterministic...
      setTimeout(() => {
        loot.close();
      }, 5000);
    }
    if (gameSupported(gameMode, true)) {
      // init resolves to an undefined instance on failure, having reported it itself
      this.mInitPromise = this.init(gameMode);
    } else {
      this.mInitPromise = Bluebird.resolve({ game: gameMode, loot: undefined });
    }
  }

  private async getLoot(api: IExtensionApi, gameId: string): Promise<ILootRef> {
    let res = await this.mInitPromise;
    if (res.game !== gameId) {
      this.onGameModeChanged(api, gameId);
      res = await this.mInitPromise;
    }
    return res;
  }

  private pluginDetails = async (
    api: IExtensionApi,
    gameId: string,
    plugins: string[],
    cb: (result: IPluginsLoot) => void,
  ) => {
    const callback = (res: IPluginsLoot) => {
      api.events.emit("trigger-test-run", "loot-info-updated");
      cb(res);
    };
    if (this.shouldDeferLootActivities()) {
      // Defer - the plugins will be updated once the activity is done
      callback({});
      return;
    }

    const { game, loot } = await this.getLoot(api, gameId);
    if (loot === undefined || loot.isClosed()) {
      callback({});
      return;
    }

    log("debug", "requesting plugin info", plugins);
    try {
      await loot.clearConditionCacheAsync();
      if (loot.isClosed()) {
        callback({});
        return;
      }
      // details are read off the metadata lists, so a rule change has to reach libloot first
      await this.ensureLists(game, loot);
      await loot.loadCurrentLoadOrderStateAsync();
      lootErrorReporter.succeeded(LootPhase.Metadata);
    } catch (rawErr) {
      lootErrorReporter.report(this.mExtensionApi, toLootError(rawErr), LootPhase.Metadata);
      callback({});
      return;
    }

    const result: IPluginsLoot = {};
    let error: VortexError;
    let pluginsLoaded = false;
    const state = this.mExtensionApi.store.getState();
    const pluginList: IPlugins = state.session.plugins.pluginList;

    // libloot validates exactly the plugin paths we pass (it does not scan the data folder), so one
    // corrupt plugin would fail the whole loadPlugins call. Find every invalid plugin in a single
    // header-parse pass, exclude them so one load covers the rest, then report them once.
    const deployed = plugins.filter(
      (id) => pluginList[id] !== undefined && pluginList[id].deployed,
    );
    const invalid = await findInvalidPlugins(deployed, pluginList, gameId);
    if (invalid.size > 0) {
      log("warn", "excluding invalid plugins from load", { plugins: [...invalid] });
    }
    try {
      await loot.loadPluginsAsync(
        deployed.filter((id) => !invalid.has(id)).map((name) => toPluginId(name)),
        false,
      );
      pluginsLoaded = true;
      lootErrorReporter.succeeded(LootPhase.LoadPlugins);
    } catch (rawErr) {
      const err = toLootError(rawErr);
      if (err.data.kind === "process-canceled") {
        callback({});
        return;
      }
      // libloot rejected a plugin ESPFile considered valid, so a header-parse exclusion can't help;
      // surface it rather than retrying per plugin.
      lootErrorReporter.report(this.mExtensionApi, err, LootPhase.LoadPlugins);
    }
    if (invalid.size > 0) {
      reportSkippedInvalidPlugins(this.mExtensionApi, [...invalid]);
    }

    const createEmpty = (): IPluginLoot => ({
      messages: [],
      currentTags: [],
      suggestedTags: [],
      cleanliness: [],
      dirtyness: [],
      group: undefined,
      isValidAsLightPlugin: false,
      loadsArchive: false,
      isEmpty: false,
      incompatibilities: [],
      requirements: [],
      version: "",
    });

    let closed = loot.isClosed();
    await Promise.all(
      plugins.map(async (pluginName: string) => {
        if (closed) {
          result[pluginName] = createEmpty();
          return;
        }
        try {
          const meta: PluginMetadata | undefined = await loot.getPluginMetadataAsync(pluginName);
          let info;
          try {
            const id = toPluginId(pluginName);
            if (pluginList[id] !== undefined && pluginList[id].deployed) {
              info = await loot.getPluginAsync(pluginName);
            }
          } catch (err) {
            const gameMode = activeGameId(this.mExtensionApi.store.getState());
            log("error", "failed to get plugin info", {
              pluginName,
              error: getErrorMessageOrDefault(err),
              gameMode,
              gameId,
            });
          }

          const toRef = (iter) => ({
            name: iter.name,
            display: iter.displayName,
          });

          const missingMetaMessage =
            "No LOOT metadata could be found for this plugin. This is usually fine, but you may have to assign it a different Group to help LOOT sort it correctly.";
          const lootMessage: Message = {
            type: -1,
            content: missingMetaMessage,
            condition: "always",
          };
          result[pluginName] = {
            messages:
              !meta && !nativePlugins(gameId).includes(pluginName)
                ? [lootMessage]
                : meta?.messages || [],
            currentTags: info?.bashTags?.filter?.((tag) => !!tag) || [],
            suggestedTags: meta?.tags?.filter?.((tag) => !!tag) || [],
            cleanliness: meta?.cleanInfo || [],
            dirtyness: meta?.dirtyInfo || [],
            group: meta?.group || "",
            requirements: (meta?.requirements || []).map(toRef),
            incompatibilities: (meta?.incompatibilities || []).map(toRef),
            isValidAsLightPlugin: pluginsLoaded && info !== undefined && info.isValidAsLightPlugin,
            loadsArchive: pluginsLoaded && info !== undefined && info.loadsArchive,
            isEmpty: pluginsLoaded && info !== undefined && info.isEmpty,
            version: pluginsLoaded && info !== undefined ? info.version : "",
          };
        } catch (rawErr) {
          const err = toLootError(rawErr);
          result[pluginName] = createEmpty();
          if ((rawErr as { arg?: unknown }).arg !== undefined) {
            // invalid parameter. This simply means that loot has no meta data for this plugin
            // so that's not a problem
          } else if (err.data.kind === "process-canceled") {
            closed = true;
            return;
          } else {
            log("error", "Failed to get plugin meta data from loot", {
              pluginName,
              error: err.message,
            });
            error = err;
          }
        }
      }),
    ).then(() => {
      if (error !== undefined && !closed) {
        lootErrorReporter.report(this.mExtensionApi, error, LootPhase.Metadata);
      }
      callback(result);
    });
  };

  /**
   * Brings libloot's metadata up to date with the masterlist and userlist on disk, which it holds
   * in memory and never re-reads on its own.
   */
  private ensureLists = async (gameMode: string, loot: ILootProm) => {
    const paths = listPaths(getVortexPath("userData"), gameMode);
    try {
      if (await this.mLists.ensureLoaded(paths, loot)) {
        log("info", "loaded loot lists", { gameMode, ...paths });
      }
    } catch (rawErr) {
      lootErrorReporter.report(this.mExtensionApi, toLootError(rawErr), LootPhase.Lists, {
        context: { [SpanAttribute.LootGameMode]: gameMode },
      });
    }
  };

  private convertGameId(gameMode: string, masterlist: boolean) {
    // the vr games use the same masterlist as the base game but have their own game id within loot.
    // with enderal it's the other way around, they use the game id of the base game but there is
    // a separate masterlist (one for both variants)
    if (masterlist && gameMode === "fallout4vr") {
      return "fallout4";
    } else if (masterlist && gameMode === "skyrimvr") {
      return "skyrimse";
    } else if (masterlist && gameMode === "oblivionremastered") {
      return "oblivion";
    } else if (gameMode === "enderal") {
      return masterlist ? "enderal" : "skyrim";
    } else if (gameMode === "enderalspecialedition") {
      return masterlist ? "enderal" : "skyrimse";
    }
    return gameMode;
  }

  // tslint:disable-next-line:member-ordering
  private init = Bluebird.method(async (gameMode: string) => {
    const localPath = pluginPath(gameMode);
    try {
      await fs.ensureDirAsync(localPath);
    } catch (err) {
      this.mExtensionApi.showErrorNotification("Failed to create necessary directory", err, {
        allowReport: false,
      });
    }

    let loot: ILootProm;

    try {
      loot = Bluebird.promisifyAll(
        await getLootProm().createAsync(
          this.convertGameId(gameMode, false),
          this.gamePath,
          localPath,
          "en",
          this.logCB,
          this.fork,
        ),
      ) as unknown as ILootProm;
    } catch (rawErr) {
      const err = toLootError(rawErr);
      log("error", "failed to initialize LOOT", { kind: err.data.kind, error: err.message });
      lootErrorReporter.report(this.mExtensionApi, err, LootPhase.Init, {
        context: { [SpanAttribute.LootGameMode]: gameMode },
      });
      return { game: gameMode, loot: undefined };
    }
    // a fresh instance holds no lists, whatever was loaded for the game before it
    this.mLists.invalidate();
    await this.downloadMasterlist(gameMode);

    try {
      // the lists have to be loaded at least once, even when the download failed
      await this.ensureLists(gameMode, loot);
      await loot.loadCurrentLoadOrderStateAsync();
      lootErrorReporter.succeeded();
    } catch (rawErr) {
      lootErrorReporter.report(this.mExtensionApi, toLootError(rawErr), LootPhase.Lists, {
        context: { [SpanAttribute.LootGameMode]: gameMode },
      });
    }
    // the instance is ready, so a download may load into it from here on
    this.mLoot = { game: gameMode, loot };

    return { game: gameMode, loot };
  });

  private fork = (modulePath: string, args: string[]) => {
    const attempt = (retries: number): Bluebird<void> => {
      return (this.mExtensionApi as any)
        .runExecutable(process.execPath, [modulePath].concat(args || []), {
          detach: false,
          suggestDeploy: false,
          expectSuccess: true,
          env: {
            ELECTRON_RUN_AS_NODE: "1",
          },
        })
        .catch((err: Error) => {
          if ((err as any).code === "EBUSY" && retries > 0) {
            log("debug", "LOOT fork got EBUSY, retrying", {
              retriesLeft: retries,
            });
            return Bluebird.delay(500).then(() => attempt(retries - 1));
          }
          return Bluebird.reject(err);
        });
    };

    attempt(5)
      .catch(UserCanceled, () => null)
      .catch(ProcessCanceled, () => null)
      .catch((err) => {
        log("warn", "LOOT process died", { error: err.message });
        const restarting = this.mRestarts > 0;
        // the exit code and the worker's last words are all this side ever learns about the crash
        lootErrorReporter.report(
          this.mExtensionApi,
          new VortexError(err.message, { kind: "loot:process-died" }, { cause: err }),
          LootPhase.Worker,
          {
            recovering: restarting,
            context: {
              [SpanAttribute.LootRestartsLeft]: this.mRestarts,
              [SpanAttribute.LootExitCode]: err.exitCode,
            },
          },
        );
        if (restarting) {
          const gameMode = activeGameId(this.mExtensionApi.store.getState());
          --this.mRestarts;
          // the handle outlives the worker and answers isClosed() with false, so drop it here
          this.mLoot = undefined;
          if (gameSupported(gameMode, true)) {
            this.mInitPromise = this.init(gameMode);
          }
        }
      });
  };

  private logCB = (level: number, message: string) => {
    log(this.logLevel(level) as any, message);
  };

  private logLevel(level: number): string {
    switch (level) {
      case 0:
        return "debug"; // actually trace
      case 1:
        return "debug";
      case 2:
        return "info";
      case 3:
        return "warn";
      case 4:
        return "error";
      case 5:
        return "error"; // actually fatal
    }
  }

  private renderEdge(t: typeof i18next.t, edge: ICycleEdge): string {
    switch (edge.typeOfEdgeToNextVertex) {
      case EdgeType.masterlistLoadAfter:
      case EdgeType.masterlistRequirement:
        return t("masterlist");
      case EdgeType.userLoadAfter:
      case EdgeType.userRequirement:
        return t("custom");
      case EdgeType.hardcoded:
        return t("hardcoded");
      case EdgeType.assetOverlap:
        return t("overlap (asset)");
      case EdgeType.recordOverlap:
        return t("overlap (record)");
      case EdgeType.tieBreak:
        return t("tie breaker");
      default:
        return "???";
    }
  }

  private async describeEdge(
    t: typeof i18next.t,
    edge: ICycleEdge,
    edgeGroup: string,
    next: ICycleEdge,
    nextGroup: string,
    loot: ILootProm,
  ): Promise<string> {
    switch (edge.typeOfEdgeToNextVertex) {
      case EdgeType.master:
      case EdgeType.masterFlag:
        return t("{{master}} is a master and {{regular}} isn't", {
          replace: {
            master: edge.name,
            regular: next.name,
          },
        });
      case EdgeType.masterlistLoadAfter:
      case EdgeType.masterlistRequirement:
        return t("this is a masterlist rule");
      case EdgeType.userLoadAfter:
      case EdgeType.userRequirement:
        return t("this is a custom rule");
      case EdgeType.hardcoded:
        return t("hardcoded");
      case EdgeType.assetOverlap:
        return t("assets (content of BSA/BA2) overlap");
      case EdgeType.recordOverlap:
        return t("records (content of ESx) overlap");
      case EdgeType.tieBreak:
        return t("tie breaker");
      case EdgeType.userGroup:
      case EdgeType.masterlistGroup: {
        try {
          const groupPath: ICycleEdge[] = await loot.getGroupsPathAsync(
            edgeGroup || "default",
            nextGroup || "default",
          );
          return t("groups are connected like this: {{path}}", {
            replace: {
              path: groupPath
                .map((grp) => {
                  const connection =
                    grp.typeOfEdgeToNextVertex === "hardcoded"
                      ? ""
                      : ` --(${this.renderEdge(t, grp)})->`;
                  return `${grp.name}${connection}`;
                })
                .join(" "),
            },
          });
        } catch (err) {
          log("warn", "failed to determine path between groups", getErrorMessageOrDefault(err));
          return t("groups are connected");
        }
      }
    }
  }

  private getGroup(state: any, pluginName: string): { group: string; custom: boolean } {
    const ulEdge = (state.userlist.plugins ?? []).find(
      (iter) => iter.name.toLowerCase() === pluginName.toLowerCase(),
    );
    if (ulEdge !== undefined && ulEdge.group !== undefined) {
      return { group: ulEdge.group, custom: true };
    }
    const mlEdge = (state.masterlist.plugins ?? []).find(
      (iter) => iter.name.toLowerCase() === pluginName.toLowerCase(),
    );
    if (mlEdge !== undefined && mlEdge.group !== undefined) {
      return { group: mlEdge.group, custom: false };
    }
    return { group: undefined, custom: false };
  }

  private async renderCycle(
    t: typeof i18next.t,
    cycle: ICycleEdge[],
    loot: ILootProm,
  ): Promise<string> {
    const state = this.mExtensionApi.store.getState();
    const lines = await Promise.all(
      cycle.map(async (edge: ICycleEdge, idx: number) => {
        const next = cycle[(idx + 1) % cycle.length];
        const edgeGroup = this.getGroup(state, edge.name);
        const nextGroup = this.getGroup(state, next.name);

        const groupDescription = edgeGroup.custom
          ? `[tooltip="${t("This group was manually assigned")}"]` +
            `${edgeGroup.group || "default"}[/tooltip]`
          : edgeGroup.group || "default";
        const edgeDescription = await this.describeEdge(
          t,
          edge,
          edgeGroup.group,
          next,
          nextGroup.group,
          loot,
        );

        const connection = `[tooltip="${edgeDescription}"]-->[/tooltip]`;

        return `${edge.name}@[i]${groupDescription}[/i] ${connection}`;
      }),
    );
    const firstGroup = this.getGroup(state, cycle[0].name);
    return lines.join(" ") + ` ${cycle[0].name}@[i]${firstGroup.group || "default"}[/i]`;
  }

  private async getSolutions(
    t: typeof i18next.t,
    cycle: ICycleEdge[],
    loot: ILootProm,
  ): Promise<ICheckbox[]> {
    const userTypes = [EdgeType.userLoadAfter, EdgeType.userRequirement];

    const groupTypes = [EdgeType.masterlistGroup, EdgeType.userGroup];

    const result: ICheckbox[] = [];

    await Promise.all(
      cycle.map(async (edge: ICycleEdge, idx: number) => {
        const next = cycle[(idx + 1) % cycle.length];
        if (userTypes.includes(edge.typeOfEdgeToNextVertex)) {
          result.push({
            id: `removerule:${edge.name}:${next.name}:${edge.typeOfEdgeToNextVertex}`,
            text: t('Remove custom rule between "{{name}}" and "{{next}}"', {
              replace: {
                name: edge.name,
                next: next.name,
              },
            }),
            value: false,
          });
        } else if (groupTypes.includes(edge.typeOfEdgeToNextVertex)) {
          const state = this.mExtensionApi.store.getState();
          const edgeGroup = this.getGroup(state, edge.name);
          const nextGroup = this.getGroup(state, next.name);
          if (edgeGroup.custom) {
            result.push({
              id: `unassign:${edge.name}`,
              text: t('Remove custom group assignment to "{{name}}"', {
                replace: {
                  name: edge.name,
                },
              }),
              value: false,
            });
          }
          if (nextGroup.custom) {
            result.push({
              id: `unassign:${next.name}`,
              text: t('Remove custom group assignment to "{{name}}"', {
                replace: {
                  name: next.name,
                },
              }),
              value: false,
            });
          }
          try {
            const groupPath: ICycleEdge[] = await loot.getGroupsPathAsync(
              edgeGroup.group || "default",
              nextGroup.group || "default",
            );
            if (groupPath.find((iter) => userTypes.indexOf(iter.typeOfEdgeToNextVertex) !== -1)) {
              result.push({
                // Storing the plugin names here instead of the group directly because the plugin
                //   names are file names on disk and thus won't contain colons, meaning we can
                //   cleanly parse this id later, the same would be more complicated with group names
                id: `resetgroups:${edge.name}:${next.name}`,
                text: t(
                  'Reset customized groups between "{{first}}@{{firstGroup}}" ' +
                    'and "{{second}}@{{secondGroup}}"',
                  {
                    replace: {
                      first: edge.name,
                      firstGroup: edgeGroup.group || "default",
                      second: next.name,
                      secondGroup: nextGroup.group || "default",
                    },
                  },
                ),
                value: false,
              });
            }
          } catch (err) {
            log("warn", "failed to determine path between groups", getErrorMessageOrDefault(err));
          }
        }
      }),
    );

    return result;
  }

  private async applyFix(key: string, loot: ILootProm) {
    const api = this.mExtensionApi;

    const args = key.split(":");
    if (args[0] === "removerule") {
      api.store.dispatch(
        removeRule(args[2], args[1], args[3] === EdgeType.userRequirement ? "requires" : "after"),
      );
    } else if (args[0] === "unassign") {
      api.store.dispatch(setGroup(args[1], undefined));
    } else if (args[0] === "resetgroups") {
      const state = api.store.getState();
      const edgeGroup = this.getGroup(state, args[1]);
      const nextGroup = this.getGroup(state, args[2]);

      try {
        const cyclePath: ICycleEdge[] = await loot.getGroupsPathAsync(
          edgeGroup.group || "default",
          nextGroup.group || "default",
        );

        cyclePath.forEach((pathEdge, idx) => {
          if (
            pathEdge.typeOfEdgeToNextVertex === EdgeType.userLoadAfter ||
            pathEdge.typeOfEdgeToNextVertex === EdgeType.userRequirement
          ) {
            const pathNext = cyclePath[(idx + 1) % cyclePath.length];
            api.store.dispatch(
              removeGroupRule(pathNext.name || "default", pathEdge.name || "default"),
            );
          }
        });
      } catch (err) {
        log("warn", "failed to determine path between groups", getErrorMessageOrDefault(err));
      }
    } else {
      api.showErrorNotification("Invalid fix instruction for cycle, please report this", key);
    }
  }

  private async reportCycle(cycle: ICycleEdge[], loot: ILootProm) {
    const api = this.mExtensionApi;
    const t = api.translate;

    let solutions: ICheckbox[];
    let renderedCycle: string;

    try {
      solutions = await this.getSolutions(t, cycle, loot);
      renderedCycle = await this.renderCycle(t, cycle, loot);
    } catch (rawErr) {
      const innerErr = toLootError(rawErr);
      if (innerErr.data.kind !== "process-canceled") {
        lootErrorReporter.report(api, innerErr, LootPhase.Cycle);
      }
      return;
    }

    const errActions: IDialogAction[] = [
      {
        label: "Close",
      },
    ];
    if (solutions.length > 0) {
      errActions.push({
        label: "Apply Selected",
      });
    }

    this.mExtensionApi.sendNotification({
      id: "loot-cycle-warning",
      type: "warning",
      message: "Plugins not sorted because of cyclic rules",
      actions: [
        {
          title: "More",
          action: (dismiss: () => void) => {
            const bbcode =
              t(
                "LOOT reported a cyclic interaction between rules.<br />" +
                  "In the simplest case this is something like " +
                  '[i]"A needs to load after B"[/i] and [i]"B needs to load after A"[/i] ' +
                  "but it can be more complicated, involving multiple plugins and groups and " +
                  "[i]their[/i] order.<br />",
                { ns: NAMESPACE },
              ) +
              "<br />" +
              renderedCycle;
            this.mExtensionApi
              .showDialog(
                "info",
                "Cyclic interaction",
                {
                  bbcode,
                  checkboxes: solutions,
                },
                errActions,
              )
              .then(async (result) => {
                if (result.action === "Apply Selected") {
                  const selected = Object.keys(result.input).filter((key) => result.input[key]);

                  const sorted = selected.sort((lhs, rhs) => {
                    // reset groups first because if one of the other commands changes the
                    // groups those might not work any more or reset a different list of groups
                    if (lhs.startsWith("resetgroups")) {
                      return -1;
                    } else if (rhs.startsWith("resetgroups")) {
                      return 1;
                    } else {
                      return lhs.localeCompare(rhs);
                    }
                  });

                  for (const key of sorted) {
                    await this.applyFix(key, loot);
                  }

                  if (sorted.length > 0) {
                    // the file write can land within the same file-time tick
                    this.mLists.invalidate();
                    // small delay to allow the persistor to flush the
                    // updated userlist.yaml to disk before LOOT re-reads it
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    this.onSort(true);
                  }
                }
              });
          },
        },
      ],
    });
  }
}

export default LootInterface;
