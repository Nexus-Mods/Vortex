import { stat } from "node:fs/promises";
import * as path from "node:path";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { ITestResult, ProblemSeverity } from "../../../types/ITestResult";
import { hasCollectionActiveSession } from "../../../util/collectionInstallSessionSelectors";
import type { ICollectionSource } from "../../../util/collectionMembershipSelectors";
import {
  activeCollectionIndex,
  formatCollectionSource,
} from "../../../util/collectionMembershipSelectors";
import ConcurrencyLimiter from "../../../util/ConcurrencyLimiter";
import { recordErrorSpan } from "../../../util/errorHandling";
import { batchDispatch } from "../../../util/util";
import { modsForGame, needToDeployForGame } from "../../mod_management/selectors";
import { activeGameId, activeProfile } from "../../profile_management/selectors";
import { updatePluginWarnings } from "../actions/plugins";
import { NAMESPACE } from "../statics";
import type { ILootFailure } from "../types/ILoot";
import type { IPluginLoadOrderEntry } from "../types/IPluginLoadOrderEntry";
import type { IPlugins } from "../types/IPlugins";
import type { IStateWithGamebryo } from "../types/IStateWithGamebryo";
import { gameDataPath, gameSupported, nativePlugins, requiresLoadedMasters } from "./gameSupport";
import { pluginLink, showPluginCallbacks } from "./showPlugin";
import { definedAttributes, SpanAttribute, type SpanAttributes } from "./spanAttributes";
import toPluginId from "./toPluginId";

/**
 * Why a plugin's master is not available to it. NotInstalled and NotEnabled are the user's install
 * state; RemovedExternally and Unscanned are the plugin list disagreeing with the game folder, as
 * is NotDeployed once nothing is left to rescan.
 */
export const MasterState = {
  NotInstalled: "not-installed",
  NotDeployed: "not-deployed",
  NotEnabled: "not-enabled",
  RemovedExternally: "removed-externally",
  Unscanned: "unscanned",
} as const;

export type MasterState = (typeof MasterState)[keyof typeof MasterState];

export interface IMissingMaster {
  // plugin id of the dependent
  plugin: string;
  // the master as the dependent's header names it
  master: string;
  state: MasterState;
}

/** The span attributes for one missing master. */
type DescribeMissing = (entry: IMissingMaster) => Record<string, string | number | boolean>;

// header parses in flight at once
const LOOKUP_CONCURRENCY = 20;

/** What a master check knows about the game besides the plugin headers. */
export interface IMasterCheck {
  pluginList: IPlugins;
  // plugin id -> its load order entry
  loadOrder: Record<string, IPluginLoadOrderEntry>;
  // the game's native plugins as lowercase ids
  natives: string[];
  // the game's Data folder
  dataPath: string;
  requiresLoadedMasters: boolean;
  // nothing is left running that would still rescan the plugin list
  settled: boolean;
}

export function masterCheckOf(state: IStateWithGamebryo, gameMode: string): IMasterCheck {
  return {
    pluginList: state.session.plugins.pluginList ?? {},
    loadOrder: state.loadOrder,
    natives: nativePlugins(gameMode),
    dataPath: gameDataPath(gameMode),
    requiresLoadedMasters: requiresLoadedMasters(gameMode),
    settled: !hasCollectionActiveSession(state) && needToDeployForGame(state, gameMode) !== true,
  };
}

/**
 * Whether the state contradicts what Vortex itself did: a deployed master gone from the game
 * folder, a file the list never picked up, or a master still undeployed once everything settled.
 */
function contradictsPluginList(state: MasterState, settled: boolean): boolean {
  return (
    state === MasterState.RemovedExternally ||
    state === MasterState.Unscanned ||
    (state === MasterState.NotDeployed && settled)
  );
}

/** Classifies masters against one check, statting each master file once. */
function masterLookup(check: IMasterCheck) {
  const natives = new Set(check.natives);
  const onDisk = new Map<string, Promise<boolean>>();
  const isEnabled = (id: string) => check.loadOrder[id]?.enabled === true || natives.has(id);
  const isOnDisk = (id: string, master: string) => {
    let known = onDisk.get(id);
    if (known === undefined) {
      known = stat(path.join(check.dataPath, master)).then(
        () => true,
        () => false,
      );
      onDisk.set(id, known);
    }
    return known;
  };
  const stateOf = async (master: string): Promise<MasterState | undefined> => {
    const id = toPluginId(master);
    const known = check.pluginList[id];
    if (!(await isOnDisk(id, master))) {
      if (known === undefined) {
        return MasterState.NotInstalled;
      }
      return known.deployed === true ? MasterState.RemovedExternally : MasterState.NotDeployed;
    }
    if (known === undefined) {
      return MasterState.Unscanned;
    }
    return isEnabled(id) ? undefined : MasterState.NotEnabled;
  };
  return { isEnabled, stateOf };
}

/** Every (plugin, master) pair whose master the plugin cannot load with, and why. */
export async function findMissingMasters(
  check: IMasterCheck,
  getMasters: (filePath: string) => Promise<string[]>,
): Promise<IMissingMaster[]> {
  const { isEnabled, stateOf } = masterLookup(check);
  const limiter = new ConcurrencyLimiter(LOOKUP_CONCURRENCY);
  const plugins = Object.keys(check.pluginList).filter(
    (plugin) => check.requiresLoadedMasters || isEnabled(plugin),
  );
  const perPlugin = await Promise.all(
    plugins.map((plugin) =>
      limiter.do(async (): Promise<IMissingMaster[]> => {
        const masters = await getMasters(check.pluginList[plugin].filePath).catch(
          (): string[] => [],
        );
        const states = await Promise.all(masters.map(stateOf));
        const dependentEnabled = isEnabled(plugin);
        // libloot loads disabled plugins too, so a disabled dependent only needs its masters
        // present; an enabled one also needs them enabled for the game
        return masters.flatMap((master, idx) => {
          const state = states[idx];
          return state === undefined || (state === MasterState.NotEnabled && !dependentEnabled)
            ? []
            : [{ plugin, master, state }];
        });
      }),
    ),
  );
  return perPlugin.flat();
}

/** The plugin's requirement in LOOT's phrasing, for the health check row and the sort failure. */
function describeMasterState(
  translate: IExtensionApi["translate"],
  master: string,
  state: MasterState,
): string {
  const options = { replace: { master }, ns: NAMESPACE };
  switch (state) {
    case MasterState.NotInstalled:
      return translate('requires "{{master}}" to be installed, but it is missing', options);
    case MasterState.NotDeployed:
      return translate('requires "{{master}}", which is installed but not deployed', options);
    case MasterState.NotEnabled:
      return translate('requires "{{master}}" to be enabled, but it is disabled', options);
    case MasterState.RemovedExternally:
      return translate(
        'requires "{{master}}", which was in the game folder when Vortex last scanned it but is gone',
        options,
      );
    case MasterState.Unscanned:
      return translate(
        'requires "{{master}}", which is in the game folder but not in Vortex\'s plugin list',
        options,
      );
  }
}

/**
 * One run reports at most this many masters. A collection that breaks dozens of them says the same
 * thing in every span, and "missing.count" carries the true total.
 */
const MAX_REPORTED_PER_RUN = 25;

/**
 * Forwards the masters whose state contradicts the plugin list to telemetry, once per master per
 * state. Skips the run entirely, memory intact, while a deployment or collection install is still
 * due to rescan the list.
 */
export class MissingMasterReporter {
  // "<game>|<plugin>|<master id>|<state>" for every contradiction recorded or seen last run
  private mReported = new Set<string>();

  constructor(private readonly mRecord: typeof recordErrorSpan = recordErrorSpan) {}

  public report(
    gameMode: string,
    missing: IMissingMaster[],
    settled: boolean,
    makeDescribe: () => DescribeMissing,
  ): void {
    if (!settled) {
      return;
    }
    const next = new Set<string>();
    let describe: DescribeMissing | undefined;
    let reported = 0;
    for (const entry of missing) {
      if (!contradictsPluginList(entry.state, settled)) {
        continue;
      }
      const key = `${gameMode}|${entry.plugin}|${toPluginId(entry.master)}|${entry.state}`;
      // a master over the cap still counts as seen, so it cannot dribble out run after run
      next.add(key);
      if (!this.mReported.has(key) && reported < MAX_REPORTED_PER_RUN) {
        reported += 1;
        describe ??= makeDescribe();
        this.mRecord(
          "A plugin's master is missing from the plugin list",
          new Error(`"${entry.plugin}" requires "${entry.master}" (${entry.state})`),
          describe(entry),
        );
      }
    }
    this.mReported = next;
  }
}

const reporter = new MissingMasterReporter();

/** Where a plugin came from, for the span that reports it. */
interface IPluginOrigin {
  // the public Nexus ids of the mod that installed the plugin
  modId: number | undefined;
  fileId: number | undefined;
  collection: ICollectionSource | undefined;
  modEnabled: boolean | undefined;
}

const sameCollection = (lhs: ICollectionSource, rhs: ICollectionSource): boolean =>
  lhs.collectionSlug === rhs.collectionSlug && lhs.revisionNumber === rhs.revisionNumber;

/**
 * The span attributes for one missing master: both sides' mods, the collections they came from and
 * how widespread the problem is, so a broken collection revision is identifiable from one span.
 */
export function makeDescribeMissing(
  state: IStateWithGamebryo,
  gameMode: string,
  check: IMasterCheck,
  missing: IMissingMaster[],
): DescribeMissing {
  const mods = modsForGame(state, gameMode);
  const profile = activeProfile(state);
  const collections = activeCollectionIndex(state);
  const contradicting = missing.filter((entry) =>
    contradictsPluginList(entry.state, check.settled),
  ).length;

  const originOf = (pluginId: string): IPluginOrigin => {
    const modId = check.pluginList[pluginId]?.modId;
    const mod = modId !== undefined && modId !== "" ? mods[modId] : undefined;
    return {
      modId: mod?.attributes?.modId,
      fileId: mod?.attributes?.fileId,
      collection: collections.sourceOf(modId),
      modEnabled: mod === undefined ? undefined : profile?.modState?.[mod.id]?.enabled === true,
    };
  };

  return (entry) => {
    const dependent = originOf(entry.plugin);
    const master = originOf(toPluginId(entry.master));
    const attributes: SpanAttributes = {
      [SpanAttribute.MasterState]: entry.state,
      [SpanAttribute.MasterName]: entry.master,
      [SpanAttribute.MasterModId]: master.modId,
      [SpanAttribute.MasterFileId]: master.fileId,
      [SpanAttribute.MasterCollection]:
        master.collection && formatCollectionSource(master.collection),
      [SpanAttribute.MasterModEnabled]: master.modEnabled,
      [SpanAttribute.MasterSameCollection]:
        dependent.collection !== undefined && master.collection !== undefined
          ? sameCollection(dependent.collection, master.collection)
          : undefined,
      [SpanAttribute.PluginName]: entry.plugin,
      [SpanAttribute.PluginModId]: dependent.modId,
      [SpanAttribute.PluginFileId]: dependent.fileId,
      [SpanAttribute.PluginCollection]:
        dependent.collection && formatCollectionSource(dependent.collection),
      [SpanAttribute.CollectionsEnabled]: collections.enabled.map(formatCollectionSource).join(","),
      [SpanAttribute.CollectionsCount]: collections.enabled.length,
      // how the run splits: every unavailable master, and the ones the plugin list got wrong.
      // Only the latter are reported, so one span says how many others came with it
      [SpanAttribute.MissingCount]: missing.length,
      [SpanAttribute.MissingContradicting]: contradicting,
    };
    return definedAttributes(attributes);
  };
}

/**
 * The master-missing health check: flags every plugin with an unavailable master, forwards the
 * states the plugin list got wrong, and describes each requirement in LOOT's words.
 */
export async function checkMissingMasters(
  api: IExtensionApi,
  getMasters: (filePath: string) => Promise<string[]>,
): Promise<ITestResult | undefined> {
  const state = api.getState<IStateWithGamebryo>();
  const gameMode = activeGameId(state);
  if (!gameSupported(gameMode)) {
    return undefined;
  }
  const check = masterCheckOf(state, gameMode);
  const missing = await findMissingMasters(check, getMasters);
  const pluginIds = Object.keys(check.pluginList);

  const flagged = new Set(missing.map((entry) => entry.plugin));
  batchDispatch(
    api.store,
    pluginIds
      .filter(
        (plugin) =>
          (check.pluginList[plugin].warnings?.["missing-master"] === true) !== flagged.has(plugin),
      )
      .map((plugin) => updatePluginWarnings(plugin, "missing-master", flagged.has(plugin))),
  );
  reporter.report(gameMode, missing, check.settled, () =>
    makeDescribeMissing(state, gameMode, check, missing),
  );
  if (missing.length === 0) {
    return undefined;
  }

  const t = api.translate;
  const rows = missing.map((entry) => {
    const name = path.basename(check.pluginList[entry.plugin].filePath);
    const requirement = describeMasterState(t, pluginLink(entry.master), entry.state);
    return `[tr][td]${pluginLink(name)}[/td][td]${requirement}[/td][/tr]`;
  });
  const severity: ProblemSeverity = missing.some((entry) =>
    contradictsPluginList(entry.state, check.settled),
  )
    ? "error"
    : "warning";
  return {
    description: {
      short: "Missing Masters",
      long:
        t("Some of the enabled plugins depend on others that are not available:", {
          ns: NAMESPACE,
        }) +
        "[table][tbody]" +
        rows.join("\n") +
        "[/tbody][/table]",
      context: { callbacks: showPluginCallbacks(api) },
    },
    severity,
    // never hideable: a hidden warning would hide the error grade of this check as well
    allowSuppress: false,
  };
}

/** What to tell the user when libloot refused a load because this master is not loaded. */
export async function explainMasterNotLoaded(
  api: IExtensionApi,
  gameMode: string,
  master: string,
): Promise<ILootFailure> {
  const check = masterCheckOf(api.getState<IStateWithGamebryo>(), gameMode);
  const masterState = await masterLookup(check).stateOf(master);
  const t = api.translate;
  if (masterState === undefined) {
    return {
      severity: "warning",
      message: t('LOOT could not load "{{master}}"', { replace: { master }, ns: NAMESPACE }),
    };
  }
  return {
    severity: contradictsPluginList(masterState, check.settled) ? "error" : "warning",
    message: t("a plugin {{requirement}}", {
      replace: { requirement: describeMasterState(t, master, masterState) },
      ns: NAMESPACE,
    }),
  };
}
