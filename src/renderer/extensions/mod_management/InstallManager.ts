/**
 * InstallManager - Handles mod installation with phased collection support.
 *
 * ## Phased Installation Methods
 *
 * The following methods work together to manage phase-gated collection installs:
 *
 * 1. `ensurePhaseState(sourceModId)` - Initialize phase tracking for a collection
 *    - Creates tracking maps for active/pending installations per phase
 *    - Sets up deployment scheduling and re-queue prevention
 *
 * 2. `markPhaseDownloadsFinished(sourceModId, phase, api)` - Called when downloads for a phase complete
 *    - Marks phase as ready for installation
 *    - Sets `allowedPhase` if this is the first phase
 *    - Calls `maybeAdvancePhase()` to check if we can progress
 *
 * 3. `maybeAdvancePhase(sourceModId, api)` - Attempts to advance to next phase
 *    - Checks if current phase is deployed
 *    - Verifies no active installations in current phase
 *    - Advances `allowedPhase` to next incomplete phase
 *    - Starts pending installations for newly-allowed phase
 *
 * 4. `scheduleDeployOnPhaseSettled(api, sourceModId, phaseNum)` - Schedules deployment when phase completes
 *    - Called with `options.deployOnSettle = true`
 *    - Sets `isDeploying` flag to block new installations
 *    - Runs deployment, then clears flag and resumes installations
 *
 * 5. `startPendingForPhase(sourceModId, phase)` - Starts queued installations for a phase
 *    - Called when phase becomes allowed or after deployment completes
 *
 * ## Phase State Structure (mInstallPhaseState)
 *
 * - `allowedPhase` - Current phase that can install
 * - `downloadsFinished` - Phases with completed downloads
 * - `pendingByPhase` - Queued installs per phase
 * - `activeByPhase` - Active install count per phase
 * - `deployedPhases` - Phases that have been deployed
 * - `isDeploying` - CRITICAL: Blocks installs during deployment
 *
 * See AGENTS-COLLECTIONS.md for architectural overview.
 */
import {
  removeDownload,
  setDownloadModInfo,
  startActivity,
  stopActivity,
} from "../../actions";
import {
  type IConditionResult,
  type IDialogContent,
  showDialog,
  dismissNotification,
} from "../../actions/notifications";
import type { ICheckbox, IDialogResult } from "../../types/IDialog";
import type { IExtensionApi, ThunkStore } from "../../types/IExtensionContext";
import type { IProfile, IState } from "../../types/IState";
import { getBatchContext, type IBatchContext } from "../../util/BatchContext";
import ConcurrencyLimiter from "../../util/ConcurrencyLimiter";
import { NotificationAggregator } from "./NotificationAggregator";
import {
  DataInvalid,
  NotFound,
  ProcessCanceled,
  SelfCopyCheckError,
  SetupError,
  TemporaryError,
  UserCanceled,
  ArchiveBrokenError,
} from "../../util/CustomErrors";
import {
  createErrorReport,
  didIgnoreError,
  isOutdated,
  withContext,
} from "../../util/errorHandling";
import * as fs from "../../util/fs";
import type { TFunction } from "../../util/i18n";
import { log } from "../../util/log";
import { prettifyNodeErrorMessage } from "../../util/message";
import {
  activeGameId,
  activeProfile,
  downloadPathForGame,
  gameProfiles,
  installPathForGame,
  knownGames,
  lastActiveProfileForGame,
  profileById,
} from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import {
  batchDispatch,
  delay,
  isPathValid,
  setdefault,
  toPromise,
  truthy,
} from "../../util/util";
import walk from "../../util/walk";

import calculateFolderSize from "../../util/calculateFolderSize";

import {
  getCollectionActiveSession,
  getCollectionInstallProgress,
  getCollectionModByReference,
  getCollectionSessionById,
  getCollectionStatusBreakdown,
  isCollectionPhaseComplete,
} from "../collections_integration/selectors";
import { resolveCategoryId } from "../category_management/util/retrieveCategoryPath";
import {
  AlreadyDownloaded,
  DownloadIsHTML,
} from "../download_management/DownloadManager";
import { finishDownload } from "../download_management/actions/state";
import type { IDownload } from "../download_management/types/IDownload";
import getDownloadGames from "../download_management/util/getDownloadGames";

import type { IModType } from "../gamemode_management/types/IModType";
import { discoveryByGame } from "../gamemode_management/selectors";
import { getGame } from "../gamemode_management/util/getGame";
import modName, { renderModReference } from "./util/modName";
import { convertGameIdReverse } from "../nexus_integration/util/convertGameId";
import {
  setModEnabled,
  setModsEnabled,
} from "../profile_management/actions/profiles";

import {
  addModRule,
  removeModRule,
  setFileOverride,
  setINITweakEnabled,
  setModAttribute,
  setModAttributes,
  setModType,
} from "./actions/mods";
import type {
  Dependency,
  IDependency,
  IDependencyError,
  IModInfoEx,
} from "./types/IDependency";
import type { IInstallContext } from "./types/IInstallContext";
import type {
  IInstallResult,
  IInstruction,
  InstructionType,
} from "./types/IInstallResult";
import type {
  IFileListItem,
  IMod,
  IModReference,
  IModRule,
} from "./types/IMod";
import type { IModInstaller, ISupportedInstaller } from "./types/IModInstaller";
import type { IInstallationDetails, InstallFunc } from "./types/InstallFunc";
import type {
  ISupportedResult,
  ITestSupportedDetails,
  TestSupported,
} from "./types/TestSupported";
import gatherDependencies, {
  findDownloadByRef,
  findModByRef,
  lookupFromDownload,
} from "./util/dependencies";
import filterModInfo from "./util/filterModInfo";
import metaLookupMatch from "./util/metaLookupMatch";
import queryGameId from "./util/queryGameId";
import testModReference, {
  downloadToModRef,
  idOnlyRef,
  isFuzzyVersion,
  referenceEqual,
  testRefByIdentifiers,
} from "./util/testModReference";
import { getCSharpScriptAllowListForGame } from "./util/cSharpScriptAllowList";

import {
  MAX_VARIANT_NAME,
  MIN_VARIANT_NAME,
  VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
} from "./constants";
import InstallContext from "./InstallContext";
import makeListInstaller from "./listInstaller";
import deriveModInstallName from "./modIdManager";

import { HTTPError } from "@nexusmods/nexus-api";
import Bluebird, { method as toBluebird } from "bluebird";
import * as _ from "lodash";
import type { IHashResult, ILookupResult, IRule } from "modmeta-db";
import Zip from "node-7z";
import * as os from "os";
import * as path from "path";
import type * as Redux from "redux";

import { generate as shortid } from "shortid";
import type { IInstallOptions } from "./types/IInstallOptions";
import { generateCollectionSessionId } from "../collections_integration/util";
import {
  getErrorCode,
  getErrorMessage,
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";

// Interface for tracking active installation information
interface IActiveInstallation {
  installId: string;
  archiveId: string;
  archivePath: string;
  modId: string;
  gameId: string;
  callback: (error: Error, id: string) => void;
  startTime: number;
  baseName: string;
}

interface IDeploymentDetails {
  deploymentPromise: Promise<void>;
  deployOnSettle: boolean;
}

// Function to get current download manager free slots
function getDownloadFreeSlots(api: IExtensionApi): Promise<number> {
  return new Promise((resolve) => {
    api.events.emit("get-download-free-slots", (freeSlots: number) => {
      resolve(freeSlots);
    });
  });
}

// Dynamic concurrency limiter that respects download manager's free slots
class DynamicDownloadConcurrencyLimiter {
  private mQueue: Array<{
    cb: () => Bluebird<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private mRunning = 0;
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  public do<T>(cb: () => Bluebird<T>): Bluebird<T> {
    return new Bluebird<T>((resolve, reject) => {
      this.mQueue.push({ cb, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.mQueue.length === 0) {
      return;
    }

    const freeSlots = await getDownloadFreeSlots(this.mApi);
    const availableSlots = Math.max(0, freeSlots);

    const toProcess = Math.min(availableSlots, this.mQueue.length);

    for (let i = 0; i < toProcess; i++) {
      const item = this.mQueue.shift();
      if (!item) {
        break; // Queue was emptied by another process
      }

      const { cb, resolve, reject } = item;
      this.mRunning++;

      // Process each item concurrently
      cb()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.mRunning--;
          // Process next items after a short delay to allow state to update
          setTimeout(() => this.process(), 100);
        });
    }

    // If we still have items queued but no slots, check again later
    // Also periodically check for paused downloads that might need to be resumed
    if (this.mQueue.length > 0 && toProcess === 0) {
      setTimeout(() => this.process(), 500);
    }
  }
}

type ReplaceChoice = "replace" | "variant";
interface IReplaceChoice {
  id: string;
  variant: string;
  enable: boolean;
  attributes: { [key: string]: any };
  rules: IRule[];
  replaceChoice: ReplaceChoice;
}

interface IInvalidInstruction {
  type: InstructionType;
  error: string;
}

class InstructionGroups {
  public copy: IInstruction[] = [];
  public mkdir: IInstruction[] = [];
  public submodule: IInstruction[] = [];
  public generatefile: IInstruction[] = [];
  public iniedit: IInstruction[] = [];
  public unsupported: IInstruction[] = [];
  public attribute: IInstruction[] = [];
  public setmodtype: IInstruction[] = [];
  public error: IInstruction[] = [];
  public rule: IInstruction[] = [];
  public enableallplugins: IInstruction[] = [];
}

export const INI_TWEAKS_PATH = "Ini Tweaks";

export const INSTALL_ACTION = "Update current profile";
export const REPLACE_ACTION = "Update all profiles";
export const VARIANT_ACTION = "Add Variant";

const archiveExtLookup = new Set<string>([
  ".zip",
  ".z01",
  ".7z",
  ".rar",
  ".r00",
  ".001",
  ".bz2",
  ".bzip2",
  ".gz",
  ".gzip",
  ".xz",
  ".z",
  ".lzh",
]);

// file types supported by 7z but we don't want to extract
// I was tempted to put .exe in here but there may actually be cases where the
// exe is a self-extracting archive and we would be able to handle it
const FILETYPES_AVOID = [".dll"];

function nop() {
  // nop
}

function findDownloadByReferenceTag(
  downloads: Record<string, IDownload>,
  reference: IModReference,
): string | null {
  const dlId = findDownloadByRef(reference, downloads);
  if (dlId) {
    return dlId;
  }

  if (!reference?.tag) {
    return null;
  }

  return (
    Object.keys(downloads).find(
      (id) =>
        downloads[id].modInfo?.referenceTag === reference.tag ||
        (reference.md5Hint && downloads[id].fileMD5 === reference.md5Hint),
    ) || null
  );
}

function getReadyDownloadId(
  downloads: Record<string, IDownload>,
  reference: { tag?: string; md5Hint?: string },
  hasActiveOrPendingCheck: (downloadId: string) => boolean,
): string | null {
  const downloadId = findDownloadByReferenceTag(downloads, reference);

  if (!downloadId) {
    return null;
  }

  const download = downloads[downloadId];
  if (download.state === "finished" && !hasActiveOrPendingCheck(downloadId)) {
    return downloadId;
  }

  return null;
}

function getModsByPhase(allMods: any[], phase: number): any[] {
  return allMods.filter((mod: any) => (mod.phase ?? 0) === phase);
}

function withActivityTracking<T>(
  api: IExtensionApi,
  activityType: string,
  activityId: string,
  promise: Bluebird<T>,
): Bluebird<T> {
  api.store.dispatch(startActivity(activityType, activityId));
  return promise.finally(() => {
    api.store.dispatch(stopActivity(activityType, activityId));
  });
}

function findCollectionByDownload(
  state: IState,
  download: IDownload,
  sourceModId?: string,
): { collectionMod: IMod; matchingRule: IModRule; gameId: string } | null {
  const gameId = activeProfile(state)?.gameId;
  if (!gameId) {
    log("debug", "No active game profile", { downloadId: download.id });
    return null;
  }

  const activeCollection = getCollectionActiveSession(state);
  if (sourceModId != null && activeCollection == null) {
    const mods: { [modId: string]: IMod } = state.persistent.mods[gameId];
    const collectionMod = mods?.[sourceModId];
    if (!collectionMod || !download?.id) {
      log("debug", "No collection mod found for sourceModId", {
        downloadId: download.id,
        sourceModId,
      });
      return null;
    }

    const lookup = lookupFromDownload(download);

    // Download lookups will not hold any patch/filelist/installerChoices info.
    //  Which is why in this case we want to ensure that we only match using regular reference fields.
    const matchingRule = collectionMod.rules.find((rule) => {
      const { patches, fileList, installerChoices, ...refWithoutExtras } =
        rule.reference;
      return testModReference(lookup, refWithoutExtras);
    });

    if (matchingRule) {
      return { collectionMod, matchingRule, gameId };
    }
  }

  // Get the current active collection installation
  if (!activeCollection?.collectionId) {
    log("debug", "No active collection installation found", {
      downloadId: download.id,
    });
    return null;
  }

  const matchingRule = getCollectionModByReference(state, {
    tag: download.modInfo?.referenceTag,
    fileMD5: download.fileMD5,
    fileId: download.modInfo?.fileId,
    logicalFileName: download.localPath,
  });
  if (!matchingRule) {
    log("debug", "No matching rule found in collection for download", {
      downloadId: download.id,
    });
    return null;
  }

  const collectionMod =
    state.persistent.mods[gameId]?.[activeCollection.collectionId];
  if (!collectionMod) {
    log("debug", "Collection mod not found in state", {
      gameId,
      collectionId: activeCollection.collectionId,
    });
    return null;
  }
  return { collectionMod, matchingRule: matchingRule.rule, gameId };
}

/**
 * Helper: Filter rules to only include non-ignored requires/recommends rules
 */
function filterDependencyRules(rules: IModRule[]): IModRule[] {
  return (rules ?? []).filter(
    (rule: IModRule) =>
      ["recommends", "requires"].includes(rule.type) && !rule.ignored,
  );
}

/**
 * Helper: Check if dependency installation was canceled via event and handle early return
 * Returns true if should continue, false if canceled
 */
function checkAndEmitDependencyInstallStart(
  api: IExtensionApi,
  gameId: string,
  modId: string,
  isRecommended: boolean,
): boolean {
  let canceled = false;
  api.events.emit(
    "will-install-dependencies",
    gameId,
    modId,
    isRecommended,
    () => {
      canceled = true;
    },
  );
  return !canceled;
}

function validateVariantName(
  t: TFunction,
  content: IDialogContent,
): IConditionResult[] {
  const variantName =
    content.input.find((inp) => inp.id === "variant")?.value ?? "";

  if (
    variantName.length < MIN_VARIANT_NAME ||
    variantName.length > MAX_VARIANT_NAME
  ) {
    return [
      {
        id: "variant",
        actions: ["Continue"],
        errorText: t("Name must be between {{min}}-{{max}} characters long", {
          replace: {
            min: MIN_VARIANT_NAME,
            max: MAX_VARIANT_NAME,
          },
        }),
      },
    ];
  } else {
    return [];
  }
}

/**
 * central class for the installation process
 *
 * @class InstallManager
 */
class InstallManager {
  private static readonly MAX_SIMULTANEOUS_INSTALLS = 5;
  private mApi: IExtensionApi;
  private mInstallers: IModInstaller[] = [];
  private mGetInstallPath: (gameId: string) => string;
  private mDependencyInstalls: { [modId: string]: () => void } = {};
  private mDependencyDownloadsLimit: DynamicDownloadConcurrencyLimiter;

  private mNotificationAggregator: NotificationAggregator;
  private mNotificationAggregationTimeoutMS: number = 5000;

  // This limiter drives the DownloadManager to queue up new downloads.
  private mDependencyInstallsLimit: ConcurrencyLimiter = new ConcurrencyLimiter(
    10,
  );

  // Queues installations for processing - primarily used to keep track of pending installations
  //  for the current dependency phase if/when concurrent download and installation is disabled.
  private mPendingInstalls: Map<string, IDependency> = new Map();

  // Tracks the currently active installations - can be used with debug functions
  //  to inspect the state of ongoing installations
  private mActiveInstalls: Map<string, IActiveInstallation> = new Map();

  // Tracks retry counts for failed dependency installations
  private mDependencyRetryCount: Map<string, number> = new Map();
  private static readonly MAX_DEPENDENCY_RETRIES = 3;

  // Main installation concurrency limiter - replaces sequential mQueue
  private mMainInstallsLimit: ConcurrencyLimiter = new ConcurrencyLimiter(
    InstallManager.MAX_SIMULTANEOUS_INSTALLS,
  );

  constructor(api: IExtensionApi, installPath: (gameId: string) => string) {
    this.mApi = api;
    this.mGetInstallPath = installPath;
    this.mDependencyDownloadsLimit = new DynamicDownloadConcurrencyLimiter(api);
    this.mNotificationAggregator = new NotificationAggregator(api);

    api.onAsync(
      "install-from-dependencies",
      (
        dependentId: string,
        rules: IModRule[],
        recommended: boolean,
        profileId?: string,
      ) => {
        profileId =
          profileId ||
          lastActiveProfileForGame(
            api.getState(),
            activeGameId(api.getState()),
          );
        const contextName = recommended
          ? "install-recommendations"
          : "install-dependencies";
        const batchedContext = getBatchContext(contextName, "", true);
        batchedContext?.set("profileId", profileId);
        const profile = profileById(api.getState(), profileId);
        if (profile === undefined) {
          return Bluebird.reject(new ProcessCanceled("No game active"));
        }
        const { mods } = api.getState().persistent;
        const collection = mods[profile.gameId]?.[dependentId];

        if (collection === undefined) {
          return Bluebird.resolve();
        }

        const instPath = this.mGetInstallPath(profile.gameId);

        const filtered = rules.filter(
          (iter) =>
            collection.rules.find((rule) => _.isEqual(iter, rule)) !==
            undefined,
        );

        if (recommended) {
          return withActivityTracking(
            api,
            "installing_dependencies",
            dependentId,
            this.withDependenciesContext(
              "install-recommendations",
              profile.id,
              () =>
                this.installRecommendationsImpl(
                  api,
                  profile,
                  profile.gameId,
                  dependentId,
                  modName(collection),
                  filtered,
                  instPath,
                  true,
                ),
            ),
          );
        } else {
          return withActivityTracking(
            api,
            "installing_dependencies",
            dependentId,
            this.withDependenciesContext(
              "install-collections",
              profile.id,
              () =>
                this.installDependenciesImpl(
                  api,
                  profile,
                  profile.gameId,
                  dependentId,
                  modName(collection),
                  filtered,
                  instPath,
                  true,
                ),
            ),
          );
        }
      },
    );

    api.onAsync("cancel-dependency-install", (modId: string) => {
      this.mDependencyInstalls[modId]?.();
      return Bluebird.resolve();
    });

    api.onAsync("reset-dependency-installs", () => {
      // Cancel all dependency installs
      Object.values(this.mDependencyInstalls).forEach((cancel) => cancel());

      // Clear the dependency installs map
      this.mDependencyInstalls = {};

      // Reset concurrency limiters
      this.mDependencyDownloadsLimit = new DynamicDownloadConcurrencyLimiter(
        api,
      );
      this.mDependencyInstallsLimit = new ConcurrencyLimiter(10);

      // Clear all retry counters
      this.mDependencyRetryCount.clear();

      return Bluebird.resolve();
    });

    api.events.on(
      "did-finish-download",
      (downloadId: string, state: string) => {
        if (state === "finished") {
          const context = getBatchContext("install-recommendations", "");
          const sourceModId = context?.get?.("sourceModId", null);
          this.handleDownloadFinished(api, downloadId, sourceModId);
        } else if (state === "failed") {
          this.handleDownloadFailed(api, downloadId);
        }
      },
    );
  }

  private handleDownloadFinished(
    api: IExtensionApi,
    downloadId: string,
    sourceModId?: string,
  ): boolean {
    const state = api.getState();
    const download = state.persistent.downloads.files[downloadId];

    if (!download || download.state !== "finished") {
      log("debug", "Skipping download - not found or not finished", {
        downloadId,
        state: download?.state,
      });
      return false;
    }

    // Check if this download is part of a collection installation
    const collectionInfo = findCollectionByDownload(
      state,
      download,
      sourceModId,
    );
    if (!collectionInfo) {
      return false;
    }

    const { collectionMod, matchingRule, gameId } = collectionInfo;
    const collectionId = collectionMod.id;
    if (process.env.NODE_ENV !== "production") {
      log("debug", "Found collection for download", {
        downloadId,
        collectionId,
      });
    }

    const isInstallingDependencies = !!this.mDependencyInstalls[collectionId];
    const hasPhaseState = this.mInstallPhaseState.has(collectionId);

    if (!isInstallingDependencies && !hasPhaseState) {
      log(
        "debug",
        "Collection is not currently installing (no active dependency install or phase state)",
        { collectionId, downloadId },
      );
      return false;
    }

    if (hasPhaseState) {
      const phaseState = this.mInstallPhaseState.get(collectionId);
      if (phaseState) {
        // Add this download to the cache
        if (download.modInfo?.referenceTag) {
          phaseState.downloadLookupCache.byTag.set(
            download.modInfo.referenceTag,
            downloadId,
          );
        }
        if (download.fileMD5) {
          phaseState.downloadLookupCache.byMd5.set(
            download.fileMD5,
            downloadId,
          );
        }
      }
    }

    // Create a dependency object and queue the installation
    const dependency: IDependency = {
      extra: matchingRule.extra,
      reference: matchingRule.reference,
      lookupResults: [], // Will be populated if needed
      download: downloadId,
      phase: matchingRule.extra?.phase || 0,
      patches: matchingRule.extra?.patches ?? matchingRule.reference.patches,
      installerChoices: matchingRule.installerChoices,
      fileList: matchingRule.fileList ?? matchingRule.reference.fileList,
    };

    // Ensure the phase is marked as having downloads finished
    // This is needed when downloads complete after initial dependency processing
    if (hasPhaseState) {
      this.markPhaseDownloadsFinished(collectionId, dependency.phase, api);
    }

    // Queue the installation
    this.queueInstallation(
      api,
      dependency,
      downloadId,
      gameId,
      collectionId,
      matchingRule.type === "recommends",
      dependency.phase,
    );
    return true;
  }

  private handleDownloadFailed(api: IExtensionApi, downloadId: string) {
    const state = api.getState();
    const download = state.persistent.downloads.files[downloadId];

    if (!download) {
      log("debug", "Skipping download failure - download not found", {
        downloadId,
      });
      return;
    }

    // Check if this download is part of a collection installation
    const collectionInfo = findCollectionByDownload(
      state,
      download,
      downloadId,
    );
    if (!collectionInfo) {
      return;
    }

    const { collectionMod, matchingRule, gameId } = collectionInfo;
    const collectionId = collectionMod.id;
    log("debug", "Found collection for failed download", {
      downloadId,
      collectionId,
    });

    // Check if we're currently in collection installation for this collection
    const isInstallingCollection =
      !!this.mDependencyInstalls[collectionId] ||
      this.mInstallPhaseState.has(collectionId);

    if (!isInstallingCollection) {
      log(
        "debug",
        "Collection is not currently installing - ignoring download failure",
        { collectionId, downloadId },
      );
      return;
    }

    // Get the download error message
    const errorMessage =
      download.failCause?.message ||
      "Download failed due to network or server error";
    const modName = renderModReference(matchingRule.reference);
    // Report the download failure via aggregated notifications for collections
    if (this.mNotificationAggregator) {
      this.mNotificationAggregator.addNotification(
        collectionId,
        "error",
        "Collection Download Failed",
        `Failed to download "${modName}": ${errorMessage}`,
        modName,
        { allowReport: false },
      );
    } else {
      // Fallback to direct notification if aggregator not available
      api.showErrorNotification(
        "Collection Download Failed",
        `Failed to download "${modName}": ${errorMessage}`,
        {
          allowReport: false,
        },
      );
    }
  }

  private handleDownloadSkipped(
    api: IExtensionApi,
    sourceModId: string,
    dep: IDependency,
  ) {
    if (!sourceModId || !dep) {
      return;
    }

    // Check if we're currently in collection installation for this collection
    const isInstallingCollection =
      !!this.mDependencyInstalls[sourceModId] ||
      this.mInstallPhaseState.has(sourceModId);
    if (!isInstallingCollection) {
      log(
        "debug",
        "Collection is not currently installing - ignoring skipped download",
        { sourceModId },
      );
      return;
    }

    const downloads = api.getState().persistent.downloads.files;
    const dlId =
      dep.download ?? findDownloadByReferenceTag(downloads, dep.reference);
    if (dlId != null) {
      // Remove any active or pending installation for this dependency
      const installKey = this.generateDependencyInstallKey(sourceModId, dlId);
      this.mPendingInstalls.delete(installKey);
      this.mActiveInstalls.delete(installKey);
    }

    // Notify InstallDriver to update tracking status
    api.events.emit("collection-mod-skipped", dep.reference);

    // See if we can advance the phase
    this.maybeAdvancePhase(sourceModId, api);
  }

  /**
   * Get information about all currently active installations
   */
  public getActiveInstallations(): IActiveInstallation[] {
    return Array.from(this.mActiveInstalls.values());
  }

  /**
   * Get information about a specific active installation
   */
  public getActiveInstallation(
    installId: string,
  ): IActiveInstallation | undefined {
    return this.mActiveInstalls.get(installId);
  }

  /**
   * Check if an installation is currently active
   */
  public isInstallationActive(installId: string): boolean {
    return this.mActiveInstalls.has(installId);
  }

  /**
   * Get count of active installations
   */
  public getActiveInstallationCount(): number {
    return this.mActiveInstalls.size;
  }

  /**
   * Debug method: Get details about active installations
   */
  public debugActiveInstalls(): any[] {
    const now = Date.now();
    return Array.from(this.mActiveInstalls.entries()).map(([key, install]) => ({
      installId: key,
      modId: install.modId,
      gameId: install.gameId,
      baseName: install.baseName,
      durationMs: now - install.startTime,
      durationMinutes:
        Math.round(((now - install.startTime) / 60000) * 100) / 100,
    }));
  }

  /**
   * Force cleanup of stuck installations (for debugging)
   * @param maxAgeMinutes - installations older than this will be force-cleaned
   */
  public forceCleanupStuckInstalls(
    api: IExtensionApi,
    maxAgeMinutes: number = 10,
  ): number {
    const now = Date.now();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const stuckInstalls: IActiveInstallation[] = [];

    this.mActiveInstalls.forEach((install, installId) => {
      const age = now - install.startTime;
      if (age > maxAgeMs) {
        stuckInstalls.push(install);
      }
    });

    // Force cleanup of stuck installations
    stuckInstalls.forEach((install) => {
      const { installId, modId, callback } = install;
      this.mActiveInstalls.delete(installId);
      try {
        const timeoutError = new Error(
          `Installation timed out after ${maxAgeMinutes} minutes`,
        );
        timeoutError.name = "InstallationTimeoutError";
        callback(timeoutError, modId);
        log("info", "InstallManager: Called callback for stuck installation", {
          installId,
          modId,
        });
      } catch (callbackError) {
        log(
          "error",
          "InstallManager: Error calling callback for stuck installation",
          {
            installId,
            modId,
            error: getErrorMessageOrDefault(callbackError),
          },
        );
      }

      // Try to dismiss any lingering notifications
      try {
        api.store.dispatch(dismissNotification(`install_${installId}`));
        api.store.dispatch(
          dismissNotification(`ready-to-install-${installId}`),
        );
      } catch (err) {
        log("warn", "Error dismissing notification during force cleanup", {
          installId,
          error: getErrorMessageOrDefault(err),
        });
      }
    });

    return stuckInstalls.length;
  }

  /**
   * add an installer extension
   *
   * @param {number} priority priority of the installer. the lower the number the higher
   *                          the priority, so at priority 0 the extension would always be
   *                          the first to be queried
   * @param {TestSupported} testSupported
   * @param {IInstall} install
   *
   * @memberOf InstallManager
   */
  public addInstaller(
    id: string,
    priority: number,
    testSupported: TestSupported,
    install: InstallFunc,
  ) {
    this.mInstallers.push({ id, priority, testSupported, install });
    this.mInstallers.sort((lhs: IModInstaller, rhs: IModInstaller): number => {
      return lhs.priority - rhs.priority;
    });
  }

  public simulate(
    api: IExtensionApi,
    gameId: string,
    archivePath: string,
    tempPath: string,
    extractList?: IFileListItem[],
    unattended?: boolean,
    installChoices?: any,
    progress?: (entries: string[], percent: number) => void,
  ): Bluebird<IInstallResult> {
    // Create a dedicated Zip instance for this simulation to prevent conflicts
    const simulationZip = new Zip();

    let extractProm: Bluebird<any>;
    if (FILETYPES_AVOID.includes(path.extname(archivePath).toLowerCase())) {
      extractProm = Bluebird.reject(
        new ArchiveBrokenError(
          path.basename(archivePath),
          "file type on avoidlist",
        ),
      );
    } else {
      extractProm = simulationZip
        .extractFull(
          archivePath,
          tempPath,
          { ssc: false },
          progress,
          () => this.queryPassword(api.store) as any,
        )
        .catch((err: Error) =>
          this.isCritical(err.message)
            ? Bluebird.reject(
                new ArchiveBrokenError(path.basename(archivePath), err.message),
              )
            : Bluebird.reject(err),
        );
    }

    const fileList: string[] = [];

    return extractProm
      .then(({ code, errors }: { code: number; errors: string[] }) => {
        log("debug", "extraction completed");
        if (errors.length > 0) {
          const message =
            code > 1
              ? `Extraction completed with ${errors.length} error(s)`
              : `Extraction completed with ${errors.length} warning(s)`;
          const logLevel = code > 1 ? "error" : "warn";
          log(logLevel, message, {
            code,
            errors: errors.join("; "),
          });
        }
        if (code !== 0) {
          const critical = errors.find((err) => this.isCritical(err));
          if (critical !== undefined) {
            return Bluebird.reject(
              new ArchiveBrokenError(path.basename(archivePath), critical),
            );
          }
          return this.queryContinue(api, errors, archivePath);
        } else {
          return Bluebird.resolve();
        }
      })
      .then(() =>
        walk(tempPath, (iterPath, stats) => {
          if (stats.isFile()) {
            fileList.push(path.relative(tempPath, iterPath));
          } else {
            // unfortunately we also have to pass directories because
            // some mods contain empty directories to control stop-folder
            // management...
            fileList.push(path.relative(tempPath, iterPath) + path.sep);
          }
          return Bluebird.resolve();
        }),
      )
      .then(() => {
        if (truthy(extractList) && extractList.length > 0) {
          return makeListInstaller(extractList, tempPath);
        } else {
          // TODO: add installer details to the simulate installer function
          return this.getInstaller(fileList, gameId, archivePath);
        }
      })
      .then((supportedInstaller) => {
        if (supportedInstaller === undefined) {
          throw new Error("no installer supporting this file");
        }

        const { installer, requiredFiles } = supportedInstaller;
        const collectionInstallState = getCollectionActiveSession(
          api.getState(),
        );
        const overrideInstructionsFilePresentInArchive = fileList.some(
          (file) =>
            path.basename(file) === VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
        );
        const details: IInstallationDetails = collectionInstallState
          ? null
          : {
              hasInstructionsOverrideFile:
                overrideInstructionsFilePresentInArchive,
            };
        return installer.install(
          fileList,
          tempPath,
          gameId,
          (perc: number) => {
            log("info", "progress", perc);
            progress([], perc);
          },
          installChoices,
          unattended,
          archivePath,
          details,
        );
      });
  }

  /**
   * start installing a mod.
   *
   * @param {string} archiveId id of the download. may be null if the download isn't
   *                           in our download archive
   * @param {string} archivePath path to the archive file
   * @param {string} downloadGameId gameId of the download as reported by the downloader
   * @param {IExtensionApi} extension api
   * @param {*} info existing information about the mod (i.e. stuff retrieved
   *                 from the download page)
   * @param {boolean} processDependencies if true, test if the installed mod is dependent
   *                                      of others and tries to install those too
   * @param {boolean} enable if true, enable the mod after installation
   * @param {Function} callback callback once this is finished
   * @param {boolean} forceGameId set if the user has already been queried which game
   *                              to install the mod for
   * @param {IFileListItem[]} fileList if set, the listed files (and only those) get extracted
   *                                   directly, ignoring any installer scripts
   * @param {boolean} unattended if set and there is an option preset, the installation
   *                             will happen automatically without user interaction
   * @param {boolean} forceInstaller if set, this should be the id of an installer
   *                                 (registerInstaller) to be used, instead of going through
   *                                 the auto-detection.
   */
  public install(
    archiveId: string,
    archivePath: string,
    downloadGameIds: string[],
    api: IExtensionApi,
    info: any,
    processDependencies: boolean,
    enable: boolean,
    callback: (error: Error, id: string) => void,
    forceGameId?: string,
    fileList?: IFileListItem[],
    unattended?: boolean,
    forceInstaller?: string,
    allowAutoDeploy?: boolean,
    sourceModId?: string,
    modReference?: IModReference,
  ): void {
    const baseName =
      path.basename(archivePath, path.extname(archivePath)).trim() ||
      "EMPTY_NAME";
    const installId = this.generateDependencyInstallKey(sourceModId, archiveId);
    const dummyArchiveId = archiveId || "direct-install-" + shortid();
    const installInfo: IActiveInstallation = {
      installId,
      archiveId: archiveId || dummyArchiveId,
      archivePath,
      modId: baseName, // Will be updated when final modId is determined
      gameId: "", // Will be updated when gameId is determined
      callback,
      startTime: Date.now(),
      baseName,
    };
    this.mActiveInstalls.set(installId, installInfo);

    // Wrap callback to ensure proper cleanup and tracking
    const trackedCallback = (err: Error, id: string) => {
      const activeInstall = this.mActiveInstalls.get(installId);
      if (activeInstall) {
        activeInstall.modId = id || activeInstall.modId;
        if (!err) {
          log("info", "Installation completed successfully", {
            installId,
            modId: id,
            duration: Date.now() - activeInstall.startTime,
          });
        }
      }

      // Call the original callback
      callback?.(err, id);

      // Clean up tracking
      this.mActiveInstalls.delete(installId);
    };

    if (archiveId != null) {
      const download = api.getState().persistent.downloads.files[archiveId];
      if (download && download.state !== "finished") {
        const error = new Error(
          `Cannot install: download not finished (state: ${download.state})`,
        );
        trackedCallback(error, undefined);
        return;
      } else {
        modReference = modReference || downloadToModRef(download);
      }
    }

    const details: IInstallationDetails = {
      modReference,
    };

    const state = api.getState();
    const batchContext = getBatchContext(
      ["install-dependencies", "install-recommendations"],
      "",
    );
    const profileId =
      batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
    const currentProfile = profileById(state, profileId);

    // Use parallel installation concurrency limiter instead of sequential mQueue
    this.mMainInstallsLimit
      .do(() => {
        return new Promise<string>((resolve, reject) => {
          const installationZip = new Zip();

          const fullInfo = { ...info };
          let rules: IRule[] = [];
          let overrides: string[] = [];
          let destinationPath: string;
          let tempPath: string;
          // Use the already-created installation tracking
          const activeInstall = this.mActiveInstalls.get(installId);
          if (!activeInstall) {
            const error = new Error("Installation tracking lost");
            trackedCallback(error, undefined);
            reject(error);
            return;
          }

          api.dismissNotification(
            `ready-to-install-${archiveId ?? dummyArchiveId}`,
          );
          let installProfile = currentProfile;
          let modId = baseName;
          let installGameId: string;
          let installContext: InstallContext;
          let archiveMD5: string;
          let archiveSize: number;

          // Update the callback to also handle promise resolution
          const promiseCallback = (err: Error, id: string) => {
            // Update the installation info with final details before calling tracked callback
            const activeInstall = this.mActiveInstalls.get(installId);
            if (activeInstall) {
              activeInstall.modId = id || modId;
              activeInstall.gameId = installGameId || "";
            }
            trackedCallback(err, id);
            if (err) {
              reject(err);
            } else {
              resolve(id);
            }
          };
          let existingMod: IMod;
          // Start the installation process - the promise will resolve when callback is called
          const installationPromise = withContext("Installing", baseName, () =>
            (forceGameId !== undefined
              ? Bluebird.resolve(forceGameId)
              : queryGameId(api.store, downloadGameIds, modId)
            )
              .then(async (gameId) => {
                // Convert game ID from Nexus page ID to internal ID if necessary
                const state = api.getState();
                const games = knownGames(state);
                const convertedGameId = convertGameIdReverse(games, gameId);
                installGameId = convertedGameId || gameId; // Use converted ID or fallback to original

                if (installGameId === undefined) {
                  return Promise.reject(
                    new ProcessCanceled(
                      "You need to select a game before installing this mod",
                    ),
                  );
                }
                if (
                  installGameId === "site" &&
                  baseName.toLowerCase().includes("extension")
                ) {
                  // Assumption here is that anything we try to install from the "Modding Tools"/"site" domain
                  //  that contains "extension" in its archive name is an extension... If a non-extension tool
                  //  contains "extension" in its archive name... well, that's not good but there's nothing we can
                  //  do without API providing a unique tag for us to identify Vortex extensions. (AFAIK we can't even query the existing tags from the website)
                  // Installation of non-Vortex tools with the extension basename will just install as a mod for
                  //  the current game which I guess should be fine.
                  return Promise.resolve(installGameId);
                }
                if (
                  games.find((iter) => iter.id === installGameId) === undefined
                ) {
                  // Game extension for this download is not installed, this is theoretically fine as
                  //  it may be a requirement which fits multiple game extensions. Assume the game extension
                  //  and/or user know what they're doing.
                  log("warn", "Game extension for download not installed", {
                    installGameId,
                    modId,
                  });
                  installGameId = currentProfile.gameId;
                }
                const discovery = discoveryByGame(state, installGameId);
                if (discovery?.path === undefined) {
                  return Promise.reject(
                    new ProcessCanceled(
                      "You need to manage a game before installing this mod",
                    ),
                  );
                }
                if (installGameId !== currentProfile?.gameId) {
                  const installProfileId = lastActiveProfileForGame(
                    state,
                    installGameId,
                  );
                  batchContext?.set("profileId", installProfileId);
                  installProfile = profileById(state, installProfileId);
                } else if (
                  info.profileId &&
                  info.profileId !== currentProfile?.id
                ) {
                  // Use the target profile from install options (e.g., when installing for a collection
                  // on a different profile than the active one)
                  installProfile = profileById(state, info.profileId);
                }
                // TODO make the download first functionality optional
                await api.emitAndAwait(
                  "will-install-mod",
                  installGameId,
                  archiveId,
                  modId,
                  fullInfo,
                );
                return Bluebird.resolve(installGameId);
              })
              // calculate the md5 hash here so we can store it with the mod meta information later,
              // otherwise we'd not remember the hash when installing from external file
              .then((gameId) => {
                // Check if we already have the hash from the download to avoid recalculation
                const existingHash = getSafe(
                  fullInfo,
                  ["download", "fileMD5"],
                  undefined,
                );
                const existingSize = getSafe(
                  fullInfo,
                  ["download", "size"],
                  undefined,
                );
                if (existingHash && existingSize) {
                  archiveMD5 = existingHash;
                  archiveSize = existingSize;
                  return Promise.resolve(gameId);
                }

                // Only calculate hash if we don't have it
                return api.genMd5Hash(archivePath).then((hash) => {
                  archiveMD5 = hash.md5sum;
                  archiveSize = hash.numBytes;
                  try {
                    _.merge(fullInfo, {
                      download: {
                        fileMD5: archiveMD5,
                        size: archiveSize,
                      },
                    });
                  } catch (err) {
                    // no operation
                  }
                  return gameId;
                });
              })
              .then((gameId) => {
                if (installGameId === "site") {
                  // install an already-downloaded extension
                  return api
                    .emitAndAwait("install-extension-from-download", archiveId)
                    .then(() => Bluebird.reject(new UserCanceled()));
                }
                installContext = new InstallContext(
                  gameId,
                  api,
                  unattended,
                  sourceModId ? this.mNotificationAggregator : undefined,
                  sourceModId,
                );
                installContext.startIndicator(baseName);
                let dlGame: string | string[] = getSafe(
                  fullInfo,
                  ["download", "game"],
                  gameId,
                );
                if (Array.isArray(dlGame)) {
                  dlGame = dlGame[0];
                }

                return api.lookupModMeta({
                  fileMD5: archiveMD5,
                  fileSize: archiveSize,
                  gameId: installGameId,
                });
              })
              .then((modInfo: ILookupResult[]) => {
                log("debug", "got mod meta information", {
                  archivePath,
                  resultCount: modInfo.length,
                });
                const match = metaLookupMatch(
                  modInfo,
                  path.basename(archivePath),
                  installGameId,
                );
                if (match !== undefined) {
                  fullInfo.meta = match.value;
                }

                modId = this.deriveInstallName(baseName, fullInfo);
                let testModId = modId;
                // if the name is already taken, consult the user,
                // repeat until user canceled, decided to replace the existing
                // mod or provided a new, unused name

                let variantCounter: number = 0;
                let replacementChoice: ReplaceChoice = undefined;
                const checkNameLoop = () => {
                  if (replacementChoice === "replace") {
                    log("debug", '(nameloop) replacement choice "replace"', {
                      testModId: testModId ?? "<undefined>",
                    });
                    return Promise.resolve(testModId);
                  }
                  const modNameMatches = this.checkModNameExists(
                    testModId,
                    api,
                    installGameId,
                  );
                  const variantMatches = this.checkModVariantsExist(
                    api,
                    installGameId,
                    archiveId,
                  );
                  const existingIds = (
                    replacementChoice === "variant"
                      ? modNameMatches
                      : Array.from(
                          new Set([].concat(modNameMatches, variantMatches)),
                        )
                  ).filter((id) => id !== undefined);
                  if (existingIds.length === 0) {
                    log("debug", "(nameloop) no existing ids", {
                      testModId: testModId ?? "<undefined>",
                    });
                    return Promise.resolve(testModId);
                  } else {
                    const installOptions: IInstallOptions = {
                      ...info,
                      unattended,
                      variantNumber: ++variantCounter,
                      fileList,
                    };
                    return this.queryUserReplace(
                      api,
                      existingIds,
                      installGameId,
                      installOptions,
                    ).then((choice: IReplaceChoice) => {
                      if (choice.id === undefined) {
                        log("error", "(nameloop) no valid id selection", {
                          testModId,
                          modNameMatches,
                          variantMatches,
                        });
                      }
                      testModId = choice.id;
                      replacementChoice = choice.replaceChoice;
                      if (choice.enable) {
                        enable = true;
                      }

                      const activeSession = getCollectionActiveSession(
                        api.getState(),
                      );
                      if (!activeSession) {
                        // When user chooses to replace or create a variant, clear any pre-set
                        // installer options so they get a fresh installation experience
                        delete fullInfo.choices;
                        delete fullInfo.patches;
                        fileList = undefined;
                      }
                      setdefault(fullInfo, "custom", {} as any).variant =
                        choice.variant;
                      rules = choice.rules || [];
                      fullInfo.previous = choice.attributes;
                      return checkNameLoop();
                    });
                  }
                };
                return checkNameLoop();
              })
              // TODO: this is only necessary to get at the fileId and the fileId isn't
              //   even a particularly good way to discover conflicts
              .then((newModId) => {
                if (newModId === undefined) {
                  // this shouldn't be possible, how would checkNameLoop return undefined?
                  const err = new Error("failed to generate mod id");
                  err["originalModId"] = modId;
                  err["archivePath"] = archivePath;
                  return Bluebird.reject(err);
                }
                modId = newModId;
                log("debug", "mod id for newly installed mod", {
                  archivePath,
                  modId,
                });
                return filterModInfo(fullInfo, undefined);
              })
              .then((modInfo) => {
                const fileId = modInfo.fileId ?? modInfo.revisionId;
                const isCollection = modInfo.revisionId !== undefined;

                existingMod =
                  fileId !== undefined
                    ? this.findPreviousVersionMod(
                        fileId,
                        api.store,
                        installGameId,
                        isCollection,
                      )
                    : undefined;

                const mods =
                  api.getState().persistent.mods[installGameId] ?? {};
                const dependentRule: {
                  [modId: string]: { owner: string; rule: IModRule };
                } = Object.keys(mods).reduce(
                  (
                    prev: {
                      [modId: string]: { owner: string; rule: IModRule };
                    },
                    iter,
                  ) => {
                    const depRule = (mods[iter].rules ?? []).find(
                      (rule) =>
                        rule.type === "requires" &&
                        testModReference(existingMod, rule.reference),
                    );
                    if (depRule !== undefined) {
                      prev[iter] = { owner: iter, rule: depRule };
                    }
                    return prev;
                  },
                  {},
                );

                let broken: string[] = [];
                if (truthy(archiveId)) {
                  const download =
                    api.getState().persistent.downloads.files[archiveId];
                  if (download !== undefined) {
                    const lookup = lookupFromDownload(download);
                    broken = Object.keys(dependentRule).filter(
                      (iter) =>
                        !idOnlyRef(dependentRule[iter].rule.reference) &&
                        !testModReference(
                          lookup,
                          dependentRule[iter].rule.reference,
                        ),
                    );
                  }
                }
                if (broken.length > 0) {
                  return this.queryIgnoreDependent(
                    api.store,
                    installGameId,
                    broken.map((id) => dependentRule[id]),
                  );
                } else {
                  return Bluebird.resolve();
                }
              })
              .then(() => {
                // Note: We intentionally do NOT copy installerChoices from existingMod here.
                // When reinstalling or replacing a mod, the user should get a fresh installation
                // experience with the installer dialogs shown again.

                if (existingMod !== undefined && installProfile !== undefined) {
                  const wasEnabled = getSafe(
                    installProfile.modState,
                    [existingMod.id, "enabled"],
                    false,
                  );
                  return this.userVersionChoice(existingMod, api.store).then(
                    (action: string) => {
                      if (action === INSTALL_ACTION) {
                        enable = enable || wasEnabled;
                        if (wasEnabled) {
                          setModsEnabled(
                            api,
                            installProfile.id,
                            [existingMod.id],
                            false,
                            {
                              allowAutoDeploy,
                              installed: true,
                            },
                          );
                        }
                        rules = existingMod.rules || [];
                        overrides = existingMod.fileOverrides;
                        fullInfo.previous = existingMod.attributes;
                        return Bluebird.resolve();
                      } else if (action === REPLACE_ACTION) {
                        rules = existingMod.rules || [];
                        overrides = existingMod.fileOverrides;
                        fullInfo.previous = existingMod.attributes;
                        // we need to remove the old mod before continuing. This ensures
                        // the mod is deactivated and undeployed (so we're not leave dangling
                        // links) and it ensures we do a clean install of the mod
                        return new Bluebird<void>((resolve, reject) => {
                          api.events.emit(
                            "remove-mod",
                            installGameId,
                            existingMod.id,
                            (error: Error) => {
                              if (error !== null) {
                                reject(error);
                              } else {
                                // use the same mod id as the old version so that all profiles
                                // keep using it.
                                modId = existingMod.id;
                                enable = enable || wasEnabled;
                                resolve();
                              }
                            },
                            { willBeReplaced: true },
                          );
                        });
                      }
                    },
                  );
                } else {
                  return Bluebird.resolve();
                }
              })
              .then(() => {
                installContext.startInstallCB(modId, installGameId, archiveId);

                destinationPath = path.join(
                  this.mGetInstallPath(installGameId),
                  modId,
                );
                log("info", "installing to", { modId, destinationPath });
                installContext.setInstallPathCB(modId, destinationPath);
                tempPath = destinationPath + ".installing";
                return this.installInner(
                  api,
                  archivePath,
                  tempPath,
                  destinationPath,
                  installGameId,
                  installContext,
                  installationZip,
                  forceInstaller,
                  fullInfo.choices,
                  fileList,
                  unattended,
                  details,
                );
              })
              .then((result) => {
                const state: IState = api.store.getState();

                if (
                  getSafe(
                    state,
                    ["persistent", "mods", installGameId, modId, "type"],
                    "",
                  ) === ""
                ) {
                  return this.determineModType(
                    installGameId,
                    result.instructions,
                  ).then((type) => {
                    installContext.setModType(modId, type);
                    return result;
                  });
                } else {
                  return Bluebird.resolve(result);
                }
              })
              .then(async (result: { instructions: IInstruction[] }) => {
                try {
                  const overrideFile = result.instructions.find(
                    (iter) =>
                      iter.type === "copy" &&
                      path.basename(iter.source) ===
                        VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
                  );
                  if (!overrideFile) {
                    return result;
                  }

                  // Remove the override instruction - we don't want to deploy this.
                  result.instructions = result.instructions.filter(
                    (iter) => iter !== overrideFile,
                  );
                  const content = await fs.readFileAsync(
                    path.join(tempPath, overrideFile.source),
                    "utf8",
                  );
                  const rawInstructions: IInstruction[] = JSON.parse(content);

                  // filter out any instructions that could potentially be malicious.
                  const overrideInstructions: IInstruction[] =
                    rawInstructions.filter(
                      (iter) =>
                        !["generatefile", "unsupported", "error"].includes(
                          iter.type,
                        ),
                    );
                  return {
                    instructions: result.instructions,
                    overrideInstructions,
                  };
                } catch (err) {
                  log("warn", "failed to read override instructions", err);
                  return result;
                }
              })
              .then(
                (result: {
                  instructions: IInstruction[];
                  overrideInstructions?: IInstruction[];
                }) => {
                  const startTime = Date.now();
                  return this.processInstructions(
                    api,
                    installContext,
                    archivePath,
                    tempPath,
                    destinationPath,
                    installGameId,
                    modId,
                    result,
                    fullInfo.choices,
                    unattended,
                    details,
                  ).then((result) => {
                    const endTime = Date.now();
                    log("debug", "processed instructions", {
                      installId: activeInstall.installId,
                      duration: endTime - startTime,
                    });
                    return result;
                  });
                },
              )
              .finally(() => {
                if (tempPath !== undefined) {
                  log("debug", "removing temporary path", tempPath);
                  return fs.removeAsync(tempPath);
                } else {
                  return Bluebird.resolve();
                }
              })
              .then(() => {
                // Refresh download data from current state to get any Nexus info
                // (like category_id) that was fetched asynchronously after installation started
                if (archiveId) {
                  const currentDownload =
                    api.getState().persistent.downloads.files[archiveId];
                  if (currentDownload) {
                    fullInfo.download = currentDownload;
                  }
                }
                return filterModInfo(fullInfo, destinationPath);
              })
              .then((modInfo) => {
                const state = api.getState();
                const existingKeys = Object.keys(
                  state.persistent.mods[installGameId]?.[modId]?.attributes ||
                    {},
                );
                installContext.finishInstallCB(
                  "success",
                  _.omit(modInfo, existingKeys),
                );
                (rules ?? []).forEach((rule) => {
                  api.store.dispatch(addModRule(installGameId, modId, rule));
                });
                api.store.dispatch(
                  setFileOverride(installGameId, modId, overrides),
                );
                if (installProfile !== undefined) {
                  if (enable) {
                    setModsEnabled(api, installProfile.id, [modId], true, {
                      allowAutoDeploy,
                      installed: true,
                    });
                  }
                }
                this.setModSize(api, modId, installGameId);
                promiseCallback?.(null, modId);
                api.events.emit(
                  "did-install-mod",
                  installGameId,
                  archiveId,
                  modId,
                  modInfo,
                );
                return null;
              })
              .catch((err) => {
                // TODO: make this nicer. especially: The first check doesn't recognize UserCanceled
                //   exceptions from extensions, hence we have to do the string check (last one)
                const canceled =
                  err instanceof UserCanceled ||
                  err instanceof TemporaryError ||
                  err instanceof ProcessCanceled ||
                  !truthy(err) ||
                  err.message === "Canceled" ||
                  (truthy(err.stack) &&
                    err.stack.startsWith("UserCanceled: canceled by user"));
                let prom =
                  destinationPath !== undefined
                    ? fs
                        .removeAsync(destinationPath)
                        .catch(UserCanceled, () => null)
                        .catch((innerErr) => {
                          installContext.reportError(
                            'Failed to clean up installation directory "{{destinationPath}}", ' +
                              "please close Vortex and remove it manually.",
                            innerErr,
                            innerErr.code !== "ENOTEMPTY",
                            { destinationPath },
                          );
                        })
                    : Bluebird.resolve();

                if (installContext !== undefined) {
                  const pretty = prettifyNodeErrorMessage(err);
                  // context doesn't have to be set if we canceled early
                  prom = prom.then(() =>
                    installContext.finishInstallCB(
                      canceled ? "canceled" : "failed",
                      undefined,
                      api.translate(pretty.message, {
                        replace: pretty.replace,
                      }),
                      pretty,
                    ),
                  );
                }

                if (err === undefined) {
                  return prom.then(() => {
                    promiseCallback?.(new Error("unknown error"), null);
                  });
                } else if (canceled) {
                  return prom.then(() => {
                    promiseCallback?.(err, null);
                  });
                } else if (err instanceof ArchiveBrokenError) {
                  return prom.then(() => {
                    if (archiveId) {
                      api.store.dispatch(
                        finishDownload(archiveId, "failed", {
                          message: err.message,
                        }),
                      );
                    }
                    if (unattended) {
                      promiseCallback?.(err, null);
                      return Promise.resolve();
                    }
                    if (installContext !== undefined) {
                      api.sendNotification({
                        type: "info",
                        title: "Installation failed, archive is damaged",
                        message: path.basename(archivePath),
                        actions: [
                          {
                            title: "Delete",
                            action: (dismiss) => {
                              api.events.emit(
                                "remove-download",
                                archiveId,
                                dismiss,
                                { confirmed: true },
                              );
                            },
                          },
                          {
                            title: "Delete & Redownload",
                            action: (dismiss) => {
                              const state: IState = api.store.getState();
                              const download =
                                state.persistent.downloads.files[archiveId];
                              api.events.emit(
                                "remove-download",
                                archiveId,
                                () => {
                                  dismiss();
                                  api.events.emit(
                                    "start-download",
                                    download.urls,
                                    info.download,
                                    path.basename(archivePath),
                                  );
                                },
                                { confirmed: true },
                              );
                              dismiss();
                            },
                          },
                        ],
                      });
                    }
                  });
                } else if (err instanceof SetupError) {
                  return prom.then(() => {
                    if (installContext !== undefined) {
                      installContext.reportError(
                        "Installation failed",
                        err,
                        false,
                        {
                          installerPath: path.basename(archivePath),
                          message: err.message,
                        },
                      );
                    }
                    promiseCallback?.(err, null);
                  });
                } else if (err instanceof DataInvalid) {
                  return prom.then(() => {
                    if (installContext !== undefined) {
                      installContext.reportError(
                        "Installation failed",
                        "The installer {{ installerPath }} is invalid and couldn't be " +
                          "installed:\n{{ message }}\nPlease inform the mod author.\n",
                        false,
                        {
                          installerPath: path.basename(archivePath),
                          message: err.message,
                        },
                      );
                    }
                    promiseCallback?.(err, null);
                  });
                } else if (err["code"] === "MODULE_NOT_FOUND") {
                  const location =
                    err["requireStack"] !== undefined
                      ? ` (at ${err["requireStack"][0]})`
                      : "";
                  installContext.reportError(
                    "Installation failed",
                    "Module failed to load:\n{{message}}{{location}}\n\n" +
                      "This usually indicates that the Vortex installation has been " +
                      "corrupted or an external application (like an Anti-Virus) has interfered with " +
                      "the loading of the module. " +
                      "Please check whether your AV reported something and try reinstalling Vortex.",
                    false,
                    {
                      location,
                      message: err.message.split("\n")[0],
                    },
                  );
                  promiseCallback?.(err, null);
                } else {
                  return prom
                    .then(() => api.genMd5Hash(archivePath).catch(() => ({})))
                    .then((hashResult: IHashResult) => {
                      const id = `${path.basename(archivePath)} (md5: ${hashResult.md5sum})`;
                      let replace = {};
                      if (typeof err === "string") {
                        err = 'The installer "{{ id }}" failed: {{ message }}';
                        replace = {
                          id,
                          message: err,
                        };
                      }
                      if (installContext !== undefined) {
                        const browserAssistantMsg =
                          "The installer has failed due to an external 3rd " +
                          "party application you have installed on your system named " +
                          '"Browser Assistant". This application inserts itself globally ' +
                          "and breaks any other application that uses the same libraries as it does.\n\n" +
                          'To use Vortex, please uninstall "Browser Assistant".';
                        const errorMessage =
                          typeof err === "string" ? err : err.message;
                        let allowReport: boolean;
                        if (
                          err.message.includes(
                            "No compatible .NET installation",
                          )
                        ) {
                          allowReport = false;
                        }
                        !this.isBrowserAssistantError(errorMessage)
                          ? installContext.reportError(
                              "Installation failed",
                              err,
                              allowReport,
                              replace,
                            )
                          : installContext.reportError(
                              "Installation failed",
                              browserAssistantMsg,
                              false,
                            );
                      }
                      promiseCallback?.(err, modId);
                    });
                }
              })
              .finally(() => {
                if (installContext !== undefined) {
                  const state = api.store.getState();
                  const mod: IMod = getSafe(
                    state,
                    ["persistent", "mods", installGameId, modId],
                    undefined,
                  );

                  try {
                    installContext.stopIndicator(mod);
                  } catch (stopError) {
                    const err = unknownToError(stopError);
                    log(
                      "error",
                      "InstallManager: Error in stopIndicator during cleanup",
                      {
                        installId,
                        modId: modId || "unknown",
                        error: err.message,
                        stack: err.stack,
                      },
                    );
                  }
                }
              }),
          );

          // Handle the installationPromise completion/failure
          installationPromise
            .then(() => {
              // Installation completed successfully - the callback should have been called
              // If we reach here without the callback being called, something went wrong
              if (this.mActiveInstalls.has(installId)) {
                log(
                  "warn",
                  "Installation completed but callback was not called",
                  { installId, modId },
                );

                if (installContext !== undefined) {
                  try {
                    // Force call finishInstallCB if it wasn't called (this can happen with FOMOD installers)
                    if (installContext?.["mInstallOutcome"] === undefined) {
                      log(
                        "info",
                        "InstallManager: Forcing finishInstallCB call for FOMOD installer",
                        { installId, modId },
                      );
                      installContext.finishInstallCB("success", {});
                    }

                    // Manually dismiss the notification
                    const notificationId =
                      "install_" + (installContext?.["mIndicatorId"] || modId);
                    api.store.dispatch(dismissNotification(notificationId));
                    log(
                      "info",
                      "InstallManager: Manually dismissed notification",
                      { installId, notificationId },
                    );
                  } catch (cleanupError) {
                    const message = getErrorMessageOrDefault(cleanupError);
                    log(
                      "error",
                      "InstallManager: Error during manual cleanup",
                      {
                        installId,
                        error: message,
                      },
                    );
                  }
                }
                this.mActiveInstalls.delete(installId);
                resolve(modId);
              }
            })
            .catch((installError) => {
              if (this.mActiveInstalls.has(installId)) {
                log("warn", "Installation failed", {
                  installId,
                  error: installError.message,
                });
                this.mActiveInstalls.delete(installId);
                reject(installError);
              }
            });
        });
      })
      .catch((err) => {
        trackedCallback?.(unknownToError(err), null);
      });
  }

  public installDependencies(
    api: IExtensionApi,
    profile: IProfile,
    gameId: string,
    modId: string,
    silent: boolean,
    allowAutoDeploy?: boolean,
  ): Bluebird<void> {
    const state: IState = api.store.getState();
    const mod: IMod = state.persistent.mods[gameId]?.[modId];

    if (mod === undefined) {
      return Bluebird.reject(
        new ProcessCanceled(`Invalid mod specified "${modId}"`),
      );
    }

    this.repairRules(api, mod, gameId);

    const installPath = this.mGetInstallPath(gameId);
    log("info", "start installing dependencies", { modId });

    const aggregationId = `install-dependencies-${modId}`;
    this.mNotificationAggregator.startAggregation(
      aggregationId,
      this.mNotificationAggregationTimeoutMS,
    );

    return withActivityTracking(
      api,
      "installing_dependencies",
      mod.id,
      this.withDependenciesContext("install-dependencies", profile.id, () =>
        this.augmentRules(api, gameId, mod).then((rules) =>
          this.installDependenciesImpl(
            api,
            profile,
            gameId,
            mod.id,
            modName(mod),
            rules,
            installPath,
            silent,
          ),
        ),
      ).finally(() => {
        log("info", "done installing dependencies", { modId });
        this.mNotificationAggregator.stopAggregation(aggregationId);
      }),
    );
  }

  public installRecommendations(
    api: IExtensionApi,
    profile: IProfile,
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    const state: IState = api.store.getState();
    const mod: IMod = getSafe(
      state,
      ["persistent", "mods", gameId, modId],
      undefined,
    );

    if (mod === undefined) {
      return Bluebird.reject(
        new ProcessCanceled(`Invalid mod specified "${modId}"`),
      );
    }

    this.repairRules(api, mod, gameId);

    const installPath = this.mGetInstallPath(gameId);
    log("info", "start installing recommendations", { modId });

    return withActivityTracking(
      api,
      "installing_dependencies",
      mod.id,
      this.withDependenciesContext("install-recommendations", profile.id, () =>
        this.augmentRules(api, gameId, mod)
          .then((rules) =>
            this.installRecommendationsImpl(
              api,
              profile,
              gameId,
              mod.id,
              modName(mod),
              rules,
              installPath,
              false,
            ),
          )
          .finally(() => {
            log("info", "done installing recommendations", { modId });
          }),
      ),
    );
  }

  private augmentRules(
    api: IExtensionApi,
    gameId: string,
    mod: IMod,
  ): Bluebird<IRule[]> {
    // const rules = (mod.rules ?? []).slice();
    //if (mod.attributes === undefined) {
    return Bluebird.resolve(mod.rules ?? []);
    //}

    // return api.lookupModMeta({
    //   fileMD5: mod.attributes['fileMD5'],
    //   fileSize: mod.attributes['fileSize'],
    //   gameId,
    // })
    // .then(results => {
    //   rules.push(...(results[0]?.value?.rules ?? []));
    //   return Bluebird.resolve(rules);
    // });
  }

  private withDependenciesContext<T>(
    contextName: string,
    profileId: string,
    func: () => Bluebird<T>,
  ): Bluebird<T> {
    const context = getBatchContext(contextName, "", true);
    context.set("depth", context.get("depth", 0) + 1);
    context.set("remember-instructions", null);
    context.set("profileId", profileId);

    return func().finally(() => {
      const oldDepth = context.get<number>("depth", 0);
      context.set("depth", oldDepth - 1);
      if (oldDepth === 1) {
        context.set("remember", null);
      }
    });
  }

  private hasFuzzyReference(ref: IModReference): boolean {
    return (
      ref.fileExpression !== undefined ||
      ref.fileMD5 !== undefined ||
      ref.logicalFileName !== undefined
    );
  }

  private setModSize(
    api: IExtensionApi,
    modId: string,
    gameId: string,
  ): Bluebird<void> {
    const state = api.getState();
    const stagingFolder = installPathForGame(state, gameId);
    const mod = state.persistent.mods[gameId]?.[modId];
    if (mod?.installationPath === undefined) {
      log("debug", "failed to calculate modSize", "mod is not in state");
      return Bluebird.resolve();
    }
    const modPath = path.join(stagingFolder, mod.installationPath);
    return calculateFolderSize(modPath)
      .then((totalSize) => {
        api.store.dispatch(
          setModAttribute(gameId, mod.id, "modSize", totalSize),
        );
        return Bluebird.resolve();
      })
      .catch((err) => {
        log("debug", "failed to calculate modSize", err);
        return Bluebird.resolve();
      });
  }

  /**
   * Clean up pending and active installations for a specific source mod
   */
  private cleanupPendingInstalls(
    sourceModId: string,
    hard: boolean = false,
  ): void {
    // Clean up pending installs
    const pendingKeysToRemove = Array.from(this.mPendingInstalls.keys()).filter(
      (key) => key.includes(sourceModId),
    );
    pendingKeysToRemove.forEach((key) => this.mPendingInstalls.delete(key));

    // Clean up active installs (for dependencies that might be installing for this source mod)
    const activeKeysToRemove = Array.from(this.mActiveInstalls.keys()).filter(
      (key) => key.includes(sourceModId),
    );
    activeKeysToRemove.forEach((key) => this.mActiveInstalls.delete(key));

    // Clean up retry counters for this source mod
    const retryKeysToRemove = Array.from(
      this.mDependencyRetryCount.keys(),
    ).filter((key) => key.startsWith(`${sourceModId}:`));
    retryKeysToRemove.forEach((key) => this.mDependencyRetryCount.delete(key));

    if (hard) {
      this.mMainInstallsLimit.clearQueue();
      this.mDependencyInstallsLimit.clearQueue();
      this.mInstallPhaseState.delete(sourceModId);
    }
  }

  /**
   * Queue an installation to run asynchronously without blocking downloads.
   * Installers are gated by phase so higher phases won't start until lower phases finish.
   */
  private queueInstallation(
    api: IExtensionApi,
    dep: IDependency,
    downloadId: string,
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    phase: number = 0,
  ): void {
    this.ensurePhaseState(sourceModId);
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    const phaseNum = phase ?? 0;

    // Check if this installation is already active or pending
    const installKey = this.generateDependencyInstallKey(
      sourceModId,
      downloadId,
    );
    const alreadyActive = this.mActiveInstalls.has(installKey);
    const alreadyPending = this.mPendingInstalls.has(installKey);

    if (alreadyActive || alreadyPending) {
      return;
    }

    const startTask = () =>
      this.startQueuedInstallation(
        api,
        dep,
        downloadId,
        gameId,
        sourceModId,
        recommended,
        phaseNum,
      );

    const canStartTasks = this.canStartInstallationTasks(sourceModId);

    // Only initialize allowedPhase early if we are allowed to run installers alongside downloads
    if (canStartTasks && phaseState.allowedPhase === undefined) {
      phaseState.allowedPhase = phaseNum;
      // When setting initial allowed phase, mark all previous phases as downloads finished
      for (let p = 0; p < phaseNum; p++) {
        phaseState.downloadsFinished.add(p);
      }
    }

    const downloads = api.getState().persistent.downloads.files;
    const download = downloads[downloadId];
    const canStartNow = canStartTasks
      ? phaseNum <= phaseState.allowedPhase
      : false;

    // Don't start installations if deployment is in progress
    const canStartWithoutDeploymentBlock =
      canStartNow && !phaseState.isDeploying;

    if (
      canStartWithoutDeploymentBlock &&
      download?.state === "finished" &&
      download?.size > 0
    ) {
      startTask();
    } else {
      if (this.mPendingInstalls.has(installKey)) {
        return;
      }
      this.mPendingInstalls.set(installKey, dep);
      const pending = phaseState.pendingByPhase.get(phaseNum) ?? [];
      pending.push(startTask);
      phaseState.pendingByPhase.set(phaseNum, pending);
    }
  }

  private generateDependencyInstallKey(
    sourceModId: string,
    downloadId: string,
  ): string {
    return `${sourceModId}:${downloadId}`;
  }

  // Starts a queued installation task and wires up phase accounting
  private startQueuedInstallation(
    api: IExtensionApi,
    dep: IDependency,
    downloadId: string,
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    phase: number,
  ): void {
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    const installKey = this.generateDependencyInstallKey(
      sourceModId,
      downloadId,
    );
    this.mPendingInstalls.set(installKey, dep);

    // Track active count for the phase
    phaseState.activeByPhase.set(
      phase,
      (phaseState.activeByPhase.get(phase) ?? 0) + 1,
    );

    // Process installation immediately in parallel using concurrency limiter
    this.mDependencyInstallsLimit
      .do(async () => {
        const startTime = Date.now();

        // Track this dependency installation
        const depInstallInfo: IActiveInstallation = {
          installId: installKey,
          archiveId: downloadId,
          archivePath: "", // Will be updated when known
          modId: renderModReference(dep.reference),
          gameId,
          callback: () => {}, // Dependencies use different completion mechanism
          startTime,
          baseName: renderModReference(dep.reference),
        };
        this.mActiveInstalls.set(installKey, depInstallInfo);
        try {
          // Check if installation is still needed
          if (!this.mPendingInstalls.has(installKey)) {
            this.mActiveInstalls.delete(installKey);
            return;
          }

          const currentDep = this.mPendingInstalls.get(installKey);
          this.mPendingInstalls.delete(installKey);

          // Verify download is still finished before installing
          const downloads = api.getState().persistent.downloads.files;
          if (
            downloads[downloadId]?.state !== "finished" ||
            downloads[downloadId]?.size === 0
          ) {
            log("info", "Download no longer finished, skipping installation", {
              downloadId,
            });
            this.mActiveInstalls.delete(installKey);
            return;
          }

          const sourceMod = api.getState().persistent.mods[gameId][sourceModId];
          // Check if mod is already installed with matching installer choices and patches
          const mods = api.getState().persistent.mods[gameId];
          const fullReference: IModReference = {
            ...currentDep.reference,
            installerChoices: currentDep.installerChoices,
            patches: currentDep.patches,
            fileList: currentDep.fileList,
          };
          const existingMod = findModByRef(fullReference, mods);
          const modId =
            existingMod != null
              ? existingMod.id
              : await this.withInstructions(
                  api,
                  modName(sourceMod),
                  renderModReference(currentDep.reference),
                  currentDep.reference?.tag ?? downloadId,
                  currentDep.extra?.["instructions"],
                  recommended,
                  () =>
                    this.installModAsync(
                      currentDep.reference,
                      api,
                      downloadId,
                      {
                        choices: currentDep.installerChoices,
                        patches: currentDep.patches,
                      },
                      currentDep.fileList,
                      gameId,
                      true,
                      sourceModId,
                    ),
                );

          if (modId) {
            this.mActiveInstalls.delete(installKey);

            // Apply any extra attributes
            this.applyExtraFromRule(api, gameId, modId, {
              ...currentDep.extra,
              fileList: currentDep.fileList ?? currentDep.extra?.fileList,
              installerChoices: currentDep.installerChoices,
              patches: currentDep.patches ?? currentDep.extra?.patches,
            });

            const state = api.getState();

            const batchedActions = [];
            // Enable the mod only for the target profile to avoid affecting other profiles
            const batchContext = getBatchContext(
              [
                "install-dependencies",
                "install-collections",
                "install-recommendations",
              ],
              "",
            );
            const targetProfileId =
              batchContext?.get<string>("profileId") ??
              activeProfile(state)?.id;
            const targetProfile = targetProfileId
              ? profileById(state, targetProfileId)
              : undefined;

            if (targetProfile) {
              // Only modify the target profile - disable other variants and enable this one
              const otherModIds = this.checkModVariantsExist(
                api,
                gameId,
                downloadId,
              );
              for (const otherModId of otherModIds) {
                batchedActions.push(
                  setModEnabled(targetProfile.id, otherModId, false),
                );
              }
              batchedActions.push(setModEnabled(targetProfile.id, modId, true));
            } else {
              // Fallback: enable in profiles where source mod is enabled (original behavior)
              const profiles = Object.values(
                api.getState().persistent.profiles,
              ).filter(
                (prof) =>
                  prof.gameId === gameId &&
                  prof.modState?.[sourceModId]?.enabled,
              );
              profiles.forEach((prof) => {
                const otherModIds = this.checkModVariantsExist(
                  api,
                  gameId,
                  downloadId,
                );
                for (const otherModId of otherModIds) {
                  batchedActions.push(
                    setModEnabled(prof.id, otherModId, false),
                  );
                }
                batchedActions.push(setModEnabled(prof.id, modId, true));
              });
            }

            // Mark as installed as dependency
            batchedActions.push(
              setModAttribute(gameId, modId, "installedAsDependency", true),
            );
            batchDispatch(api.store, batchedActions);

            // Clear retry counter on successful installation
            this.mDependencyRetryCount.delete(installKey);
          }

          this.mActiveInstalls.delete(installKey);
        } catch (unknownError) {
          this.mActiveInstalls.delete(installKey);
          const currentRetryCount =
            this.mDependencyRetryCount.get(installKey) || 0;
          const isCanceled =
            unknownError instanceof UserCanceled ||
            unknownError instanceof ProcessCanceled;
          const hasRetriesLeft =
            currentRetryCount < InstallManager.MAX_DEPENDENCY_RETRIES;
          if (!isCanceled && hasRetriesLeft) {
            this.mPendingInstalls.set(installKey, dep); // Re-queue for potential retry
            this.mDependencyRetryCount.set(installKey, currentRetryCount + 1);
          } else {
            const err = unknownToError(unknownError);
            // Max retries exceeded, clean up and show error
            this.mDependencyRetryCount.delete(installKey);
            this.showDependencyError(
              api,
              sourceModId,
              "Failed to install dependency",
              err,
              renderModReference(dep.reference),
            );
          }
          // Don't rethrow to avoid crashing the concurrency limiter
        } finally {
          // Always decrement phase active counter
          phaseState.activeByPhase.set(
            phase,
            Math.max(0, (phaseState.activeByPhase.get(phase) ?? 1) - 1),
          );
          // Note: Don't call maybeAdvancePhase here - it should only be called when phases are actually complete
        }
      })
      .catch((unknownError) => {
        const err = unknownToError(unknownError);
        this.showDependencyError(
          api,
          sourceModId,
          "Critical error in dependency installation",
          unknownToError(err),
          renderModReference(dep.reference),
        );
        log("error", "Critical error in dependency installation", {
          downloadId,
          error: err.message,
          dependency: renderModReference(dep.reference),
        });
      });
  }

  /**
   * CRITICAL INVARIANTS for phase-gated installation:
   *
   * 1. DEPLOYMENT BLOCKING: The `isDeploying` flag MUST be set during deployment
   *    and cleared after. Never remove this check - installations must wait for
   *    deployment to complete to prevent race conditions and file conflicts.
   *
   * 2. PHASE COMPLETION: A phase is complete ONLY when BOTH conditions are true:
   *    - `activeByPhase.get(phase) === 0` (no active installations)
   *    - `pendingByPhase.get(phase)?.length === 0` (no pending installations)
   *    Checking only `active === 0` allows deployment during queued installs = BAD.
   *
   * 3. PHASE GATING: Even optional/recommended mods must wait for their phase.
   *    Never bypass phase gating - it breaks last-phase advancement logic.
   *
   * 4. POST-DEPLOYMENT: Always call `startPendingForPhase()` after deployment
   *    completes to resume any installations that were queued during deployment.
   */
  // Map tracking phase gating per sourceMod/collection
  private mInstallPhaseState: Map<
    string,
    {
      allowedPhase?: number;
      downloadsFinished: Set<number>;
      pendingByPhase: Map<number, Array<() => void>>;
      activeByPhase: Map<number, number>;
      deployedPhases: Set<number>;
      reQueueAttempted?: Map<number, number>;
      deploymentPromises?: Map<number, IDeploymentDetails>;
      isDeploying?: boolean; // Flag to track if deployment is in progress
      downloadLookupCache?: {
        // Performance optimization: cache download lookups to avoid O(n*m)
        byTag: Map<string, string>;
        byMd5: Map<string, string>;
      };
    }
  > = new Map();

  private ensurePhaseState(sourceModId: string) {
    if (!this.mInstallPhaseState.has(sourceModId)) {
      this.mInstallPhaseState.set(sourceModId, {
        allowedPhase: undefined,
        downloadsFinished: new Set<number>(),
        pendingByPhase: new Map<number, Array<() => void>>(),
        activeByPhase: new Map<number, number>(),
        deployedPhases: new Set<number>(),
        deploymentPromises: new Map<number, IDeploymentDetails>(),
        downloadLookupCache: {
          byTag: new Map<string, string>(),
          byMd5: new Map<string, string>(),
        },
      });
    }
  }

  private pollAllPhasesComplete(
    api: IExtensionApi,
    sourceModId: string,
  ): Bluebird<void> {
    const POLL_MS = 500;
    // If no progress (new mods reaching terminal state) is made for this
    // duration, attempt a rescue (force-clean stuck installs + requeue).
    const STALL_TIMEOUT_MS = 5 * 60 * 1000;

    return new Bluebird<void>((resolve) => {
      let lastProgressTime = Date.now();
      let lastTerminalCount = this.getTerminalModCount(api, sourceModId);
      let rescueAttempted = false;

      const poll = () => {
        const phaseState = this.mInstallPhaseState.get(sourceModId);
        if (!phaseState) {
          log("debug", "Phase state cleared, all phases considered complete", {
            sourceModId,
          });
          return resolve();
        }

        // Check if the dependency installation has been cancelled
        if (!this.mDependencyInstalls[sourceModId]) {
          log("debug", "Dependency installation cancelled", { sourceModId });
          return resolve();
        }

        // ── Stall detection ──
        const currentTerminalCount = this.getTerminalModCount(api, sourceModId);
        if (currentTerminalCount > lastTerminalCount) {
          lastTerminalCount = currentTerminalCount;
          lastProgressTime = Date.now();
          rescueAttempted = false;
        }

        const stallDuration = Date.now() - lastProgressTime;
        if (stallDuration > STALL_TIMEOUT_MS) {
          if (!rescueAttempted) {
            // First timeout: attempt rescue
            log("warn", "Collection install stalled, attempting rescue", {
              sourceModId,
              stallMs: stallDuration,
              terminalCount: lastTerminalCount,
              activeInstalls: this.mActiveInstalls.size,
              pendingInstalls: this.mPendingInstalls.size,
            });
            this.forceCleanupStuckInstalls(api, 1);
            const status = this.checkCollectionPhaseStatus(
              api,
              sourceModId,
              phaseState.allowedPhase ?? 0,
            );
            if (status.needsRequeue) {
              this.reQueueDownloadedMods(
                api,
                sourceModId,
                status.allMods,
                phaseState.allowedPhase ?? 0,
              );
            }
            rescueAttempted = true;
            // Give the rescue some time to take effect
            lastProgressTime = Date.now();
            setTimeout(poll, POLL_MS);
            return;
          } else {
            // Second timeout after rescue: give up
            log(
              "warn",
              "Collection install stalled after rescue attempt, resolving",
              {
                sourceModId,
                terminalCount: lastTerminalCount,
                activeInstalls: this.mActiveInstalls.size,
                pendingInstalls: this.mPendingInstalls.size,
              },
            );
            return resolve();
          }
        }

        const collectionInstallProgress = getCollectionInstallProgress(
          api.getState(),
        );
        if (!collectionInstallProgress) {
          const activeCollection = getCollectionActiveSession(api.getState());
          if (!activeCollection) {
            // The Redux session may have been cleared by the InstallDriver
            // (e.g. after required mods finish but optional downloads are
            // still in flight).  Only tear down engine state if there is
            // truly nothing left to process for this collection.
            if (!this.hasActiveOrPendingInstallation(sourceModId)) {
              log(
                "debug",
                "No active collection session and no pending work, cleaning up",
                { sourceModId },
              );
              delete this.mDependencyInstalls[sourceModId];
              this.cleanupPendingInstalls(sourceModId, true);
              return resolve();
            }
            // Still have pending/active installs — keep polling so that
            // in-flight downloads can still be requeued.
            setTimeout(poll, POLL_MS);
            return;
          }
        }

        // Check for queued deployments
        const deploymentPromises =
          phaseState.deploymentPromises || new Map<number, Promise<void>>();
        const hasQueuedDeployments = deploymentPromises.size > 0;

        if (
          collectionInstallProgress?.isComplete &&
          !this.hasActiveOrPendingInstallation(sourceModId)
        ) {
          log("debug", "All phases complete", { sourceModId });
          return resolve();
        } else {
          const collectionStatus = this.checkCollectionPhaseStatus(
            api,
            sourceModId,
            phaseState.allowedPhase ?? 0,
          );

          const currentPhaseComplete = collectionStatus.phaseComplete;
          if (
            !currentPhaseComplete &&
            collectionStatus.needsRequeue &&
            !this.hasActiveOrPendingInstallation(sourceModId)
          ) {
            // Requeue downloaded mods if phase is not complete and there are no active installations
            // This handles cases where downloads finish after installations start, or MD5 lookups complete late
            this.reQueueDownloadedMods(
              api,
              sourceModId,
              collectionStatus.allMods,
              phaseState.allowedPhase ?? 0,
            );
          }
          if (
            !hasQueuedDeployments &&
            !this.hasActiveOrPendingInstallation(sourceModId)
          ) {
            if (phaseState.deployedPhases.has(phaseState.allowedPhase ?? 0)) {
              // Phase already deployed, maybe advance
              this.maybeAdvancePhase(sourceModId, api);
            } else {
              this.scheduleDeployOnPhaseSettled(
                api,
                sourceModId,
                phaseState.allowedPhase ?? 0,
              );
            }
          }
          const canStartTasks = this.canStartInstallationTasks(sourceModId);
          const active = this.mActiveInstalls.size;
          const pendingInstalls = this.mPendingInstalls.size;
          if (canStartTasks) {
            const pendingTasks = phaseState.pendingByPhase.get(
              phaseState.allowedPhase ?? 0,
            );
            const pending = pendingTasks ? pendingTasks.length : 0;
            if (active === 0 && pending === 0) {
              if (pendingInstalls > 0) {
                this.maybeAdvancePhase(sourceModId, api);
              } else {
                this.reQueueDownloadedMods(
                  api,
                  sourceModId,
                  collectionStatus.allMods,
                  phaseState.allowedPhase ?? 0,
                );
              }
            } else if (active === 0 && pendingInstalls > 0) {
              this.startPendingForPhase(
                sourceModId,
                phaseState.allowedPhase ?? 0,
              );
            }
          }
          setTimeout(poll, POLL_MS);
        }
      };

      poll();
    });
  }

  public pollPhaseSettlement(
    api: IExtensionApi,
    sourceModId: string,
    options: {
      phase?: number; // Specific phase to poll (for deploy)
    },
  ): Bluebird<void> {
    const POLL_MS = 500;
    // If no progress is made for this duration, consider the phase stalled.
    const STALL_TIMEOUT_MS = 5 * 60 * 1000;

    let hasDeployed = false;
    return new Bluebird<void>((resolve) => {
      let lastProgressTime = Date.now();
      let lastTerminalCount = this.getTerminalModCount(api, sourceModId);

      const poll = () => {
        const phaseState = this.mInstallPhaseState.get(sourceModId);
        if (!phaseState) {
          return resolve();
        }

        // Check if the dependency installation has been cancelled
        // If mDependencyInstalls entry is missing, installation was cancelled and cleaned up
        if (!this.mDependencyInstalls[sourceModId]) {
          log(
            "debug",
            "Stopping phase polling - dependency installation cancelled",
            { sourceModId },
          );
          return resolve();
        }

        // Progress-aware stall detection — reset timer whenever a mod
        // reaches a terminal state.
        const currentTerminalCount = this.getTerminalModCount(api, sourceModId);
        if (currentTerminalCount > lastTerminalCount) {
          lastTerminalCount = currentTerminalCount;
          lastProgressTime = Date.now();
        }

        if (Date.now() - lastProgressTime > STALL_TIMEOUT_MS) {
          log("warn", "Phase settlement stalled, resolving", {
            sourceModId,
            phase: options.phase,
            stallMs: Date.now() - lastProgressTime,
            terminalCount: lastTerminalCount,
          });
          if (phaseState) {
            phaseState.isDeploying = false;
          }
          return resolve();
        }

        // Determine which phase we're checking
        const checkPhase = options.phase ?? phaseState.allowedPhase ?? 0;

        // log('debug', 'Polling phase settlement', {
        //   sourceModId,
        //   phase: checkPhase,
        //   optionsPhase: options.phase,
        //   allowedPhase: phaseState.allowedPhase,
        //   activeInstallations: active,
        //   pendingInstallations: pending,
        //   deployOnSettle: options.deployOnSettle
        // });

        // Check collection completion status
        const collectionStatus = this.checkCollectionPhaseStatus(
          api,
          sourceModId,
          checkPhase,
        );
        const existing = phaseState?.deploymentPromises.get(checkPhase);
        if (existing?.deployOnSettle && !hasDeployed) {
          // CRITICAL: Block new installations during deployment to prevent file conflicts.
          // Removing this check causes race conditions. See AGENTS-COLLECTIONS.md.
          if (phaseState) {
            phaseState.isDeploying = true;
          }

          // Deploy mods for this phase
          toPromise((cb) => api.events.emit("deploy-mods", cb))
            .then(() => {
              if (phaseState) {
                phaseState.isDeploying = false;
                phaseState.deployedPhases.add(checkPhase);
                // Start any installations that were queued during deployment
                hasDeployed = true;
                setTimeout(poll, POLL_MS);
              }
              resolve();
            })
            .catch((err) => {
              log("warn", "deploy-mods failed after phase settle", {
                sourceModId,
                phase: checkPhase,
                error: err?.message,
              });
              if (phaseState) {
                phaseState.isDeploying = false;
                // Start any installations that were queued during deployment, even if deployment failed
                this.startPendingForPhase(sourceModId, checkPhase);
              }
              resolve(); // Resolve anyway to avoid hanging
            });
        } else {
          if (collectionStatus.phaseComplete) {
            if (phaseState) {
              phaseState.isDeploying = false;
              // Start any installations that were queued during deployment
              phaseState.deployedPhases.add(checkPhase);
              this.startPendingForPhase(sourceModId, checkPhase);
              this.maybeAdvancePhase(sourceModId, api);
            }
            resolve();
          } else if (
            !collectionStatus.phaseComplete &&
            collectionStatus.needsRequeue &&
            !this.hasActiveOrPendingInstallation(sourceModId)
          ) {
            // Requeue downloaded mods if phase is not complete and there are no active installations
            // This handles cases where downloads finish after installations start, or MD5 lookups complete late
            this.reQueueDownloadedMods(
              api,
              sourceModId,
              collectionStatus.allMods,
              checkPhase,
            );
            // Continue polling after re-queue
            setTimeout(poll, POLL_MS);
          } else {
            if (
              this.mActiveInstalls.size === 0 &&
              this.mPendingInstalls.size > 0
            ) {
              // Start any pending installations if none are active
              this.startPendingForPhase(sourceModId, checkPhase);
            }
            setTimeout(poll, POLL_MS);
          }
        }
      };

      // Start polling
      poll();
    });
  }

  // Helper to check collection phase status
  private checkCollectionPhaseStatus(
    api: IExtensionApi,
    sourceModId: string,
    phase: number,
  ): {
    phaseComplete: boolean;
    needsRequeue: boolean;
    allMods: any[];
    downloadedCount: number;
    modsNeedingRequeue: number;
  } {
    const state = api.getState();
    const batchContext = getBatchContext(
      ["install-dependencies", "install-recommendations"],
      "",
    );
    const profileId =
      batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
    const profile = profileById(state, profileId);
    const sessionId = generateCollectionSessionId(sourceModId, profile?.id);
    const activeCollectionSession = getCollectionSessionById(state, sessionId);

    if (!activeCollectionSession) {
      return {
        phaseComplete: true,
        needsRequeue: false,
        allMods: [],
        downloadedCount: 0,
        modsNeedingRequeue: 0,
      };
    }

    const mods = activeCollectionSession.mods || {};
    const allMods = Object.values(mods);
    const currentPhaseMods = getModsByPhase(allMods, phase);

    const phaseComplete = isCollectionPhaseComplete(api.getState(), phase);

    // Only count downloaded mods from the current phase being checked
    const allDownloadedMods = currentPhaseMods.filter(
      (mod: any) => mod.status === "downloaded",
    );
    const downloadedCount = allDownloadedMods.length;

    // Debug: Show status distribution
    const statusCounts = {};
    allMods.forEach((mod: any) => {
      const status = mod.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Check if any downloaded mods actually need requeuing (don't have active/pending installations)
    const downloads = api.getState().persistent.downloads.files;
    let modsNeedingRequeue = 0;

    const phaseState = this.mInstallPhaseState.get(sourceModId);
    const cache = phaseState?.downloadLookupCache;

    allDownloadedMods.forEach((mod: any) => {
      const reference = mod.rule?.reference;
      if (!reference) {
        return;
      }

      let downloadId = null;

      const md5Value = reference.md5Hint ?? reference.fileMD5;
      if (cache) {
        // Use cache for fast lookup
        if (reference.tag && cache.byTag.has(reference.tag)) {
          downloadId = cache.byTag.get(reference.tag);
        } else if (md5Value && cache.byMd5.has(md5Value)) {
          downloadId = cache.byMd5.get(md5Value);
        } else {
          // This is probably a bundled mod - use full lookup
          downloadId = getReadyDownloadId(downloads, reference, (id) =>
            this.hasActiveOrPendingInstallation(sourceModId, id),
          );
        }
        if (downloadId && !downloads[downloadId]) {
          // O(n) lookup if cached downloadId is invalid
          downloadId = getReadyDownloadId(downloads, reference, (id) =>
            this.hasActiveOrPendingInstallation(sourceModId, id),
          );
        }
        if (
          downloadId &&
          this.hasActiveOrPendingInstallation(sourceModId, downloadId)
        ) {
          downloadId = null; // Invalidate if already installing
        }
      } else {
        // Fallback to slow O(n) lookup if cache doesn't exist yet
        // This shouldn't happen often since cache is built as downloads finish
        downloadId = getReadyDownloadId(downloads, reference, (id) =>
          this.hasActiveOrPendingInstallation(sourceModId, id),
        );
      }

      // If found, check if it's ready and not being installed
      if (downloadId) {
        const download = downloads[downloadId];
        if (
          (download?.state === "finished" &&
            !this.hasActiveOrPendingInstallation(sourceModId, downloadId)) ||
          (this.mActiveInstalls.size === 0 && this.mPendingInstalls.size > 0)
        ) {
          modsNeedingRequeue++;
        }
      }
    });

    const needsRequeue = modsNeedingRequeue > 0;
    return {
      phaseComplete,
      needsRequeue,
      allMods,
      downloadedCount,
      modsNeedingRequeue,
    };
  }

  /**
   * Returns the number of mods in terminal states (installed/failed/skipped)
   * for the collection session associated with sourceModId.
   * Used by the stall-detection logic in pollAllPhasesComplete.
   */
  private getTerminalModCount(api: IExtensionApi, sourceModId: string): number {
    const state = api.getState();
    const batchContext = getBatchContext(
      ["install-dependencies", "install-recommendations"],
      "",
    );
    const profileId =
      batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
    const sessionId = generateCollectionSessionId(sourceModId, profileId);
    const session = getCollectionSessionById(state, sessionId);
    if (!session?.mods) {
      return 0;
    }

    return Object.values(session.mods).filter((mod: any) =>
      ["installed", "failed", "skipped"].includes(mod.status),
    ).length;
  }

  // Helper to check if an archiveId has pending or active installations
  private hasActiveOrPendingInstallation(
    sourceModId: string,
    archiveId?: string,
  ): boolean {
    let hasPending = false;
    if (!archiveId) {
      return this.mPendingInstalls.size > 0 || this.mActiveInstalls.size > 0;
    }
    const installKey = this.generateDependencyInstallKey(
      sourceModId,
      archiveId,
    );
    if (this.mPendingInstalls.get(installKey)) {
      hasPending = true;
    }
    let hasActive = false;
    for (const [, activeInstall] of this.mActiveInstalls.entries()) {
      if (activeInstall.archiveId === archiveId) {
        hasActive = true;
        break;
      }
    }
    return hasPending || hasActive;
  }

  // Helper to re-queue downloaded mods
  private reQueueDownloadedMods(
    api: IExtensionApi,
    sourceModId: string,
    allMods: any[],
    currentPhase: number,
  ): void {
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    if (!phaseState) {
      return;
    }

    const downloads = api.getState().persistent.downloads.files;

    // Expand the filter to include mods that are downloaded OR have downloads available
    // Also log detailed status information to debug the filtering
    const allModsWithDetails = allMods.map((mod: any) => ({
      ...mod,
      downloadId: mod.rule?.reference
        ? this.findDownloadForMod(mod.rule.reference, downloads)
        : null,
    }));

    // Look for mods that are marked as 'downloaded' and ready to install
    // Do NOT include 'pending' mods as they are already queued for installation
    const allDownloadedMods = allModsWithDetails.filter((mod: any) => {
      const hasDownload = mod.downloadId !== null;
      const modPhase = mod.phase ?? 0;
      const isDownloaded = mod.status === "downloaded";

      // Allow mods from current phase or earlier phases that haven't been completed
      // This prevents the deadlock where phase 1 mods can't be processed during phase 2+ cycles
      const isEligiblePhase = modPhase <= currentPhase;

      // Only requeue mods that are 'downloaded' status - pending mods are already queued
      return isEligiblePhase && isDownloaded && hasDownload;
    });

    const downloadedPhases = new Set<number>();
    let anyQueued = false;
    let anyMarkedSkipped = false;

    allDownloadedMods.forEach((mod: any) => {
      const modPhase = mod.phase ?? 0;
      downloadedPhases.add(modPhase);

      if (modPhase > currentPhase) {
        return; // Skip this mod, it will be processed when its phase is active
      }
      const downloadId = mod.downloadId;
      if (!downloadId) {
        if (mod.type === "recommends") {
          anyMarkedSkipped = true;
        }
        return; // Skip this mod
      }

      const downloadState = downloads[downloadId]?.state;
      log("debug", "Download state check", { downloadId, downloadState });
      if (downloads[downloadId].state === "finished") {
        const hasPendingOrActive = this.hasActiveOrPendingInstallation(
          sourceModId,
          downloadId,
        );

        // Check if mod is already installed with matching installer choices and patches
        const gameId = activeGameId(api.getState());
        const mods = api.getState().persistent.mods[gameId] ?? {};
        const fullReference: IModReference | undefined = mod.rule?.reference
          ? {
              ...mod.rule.reference,
              installerChoices:
                mod.rule.installerChoices ?? mod.rule.extra?.installerChoices,
              patches: mod.rule.extra?.patches,
              fileList: mod.rule.fileList ?? mod.rule.reference?.fileList,
            }
          : undefined;
        const existingMod = fullReference && findModByRef(fullReference, mods);

        log("debug", "Requeue check", {
          downloadId,
          hasPendingOrActive,
          modId: existingMod?.id,
        });
        if (!hasPendingOrActive && !existingMod) {
          log("info", "Requeuing download for installation", { downloadId });
          const success = this.handleDownloadFinished(
            api,
            downloadId,
            sourceModId,
          );
          if (success) {
            anyQueued = true;
          } else {
            log(
              "debug",
              "Requeue failed - collection not currently installing",
              { downloadId },
            );
          }
        } else if (!hasPendingOrActive && existingMod) {
          const installKey = this.generateDependencyInstallKey(
            sourceModId,
            downloadId,
          );
          this.mPendingInstalls.delete(installKey);
          this.mActiveInstalls.delete(installKey);
          api.events.emit(
            "did-install-mod",
            gameId,
            downloadId,
            existingMod.id,
            existingMod.attributes,
          );
        } else {
          log("debug", "Download already has pending/active installation", {
            downloadId,
          });
        }
      } else {
        log("debug", "Download not in finished state", {
          downloadId,
          state: downloadState,
        });
      }
    });

    // If we marked optional mods as skipped, check if their phases are now complete
    if (anyMarkedSkipped) {
      const phasesToCheck = Array.from(downloadedPhases).filter(
        (p) => p <= (phaseState.allowedPhase ?? 0),
      );
      phasesToCheck.forEach((checkPhase) => {
        const completion = isCollectionPhaseComplete(
          api.getState(),
          checkPhase,
        );

        // If all required mods are complete and phase not already deployed, schedule deployment
        if (completion && !phaseState.deployedPhases.has(checkPhase)) {
          // Schedule deployment which will mark the phase as deployed when it completes
          this.scheduleDeployOnPhaseSettled(api, sourceModId, checkPhase);
        }
      });
    }

    // Initialize or advance phase system if needed
    if (anyQueued) {
      if (phaseState.allowedPhase === undefined) {
        const lowestPhase = Math.min(...Array.from(downloadedPhases));
        phaseState.allowedPhase = lowestPhase;
        downloadedPhases.forEach((p) => phaseState.downloadsFinished.add(p));
        this.startPendingForPhase(sourceModId, lowestPhase);
        this.maybeAdvancePhase(sourceModId, api);
      } else {
        // Phase already initialized, just ensure downloads are marked and try to advance
        downloadedPhases.forEach((p) => {
          if (!phaseState.downloadsFinished.has(p)) {
            phaseState.downloadsFinished.add(p);
          }
        });
        // Try to start any pending installations and advance phases
        this.startPendingForPhase(sourceModId, phaseState.allowedPhase);
        this.maybeAdvancePhase(sourceModId, api);
      }
    }
  }

  public isPhaseDeployed(sourceModId: string, phase: number): boolean {
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    return phaseState?.deployedPhases.has(phase) ?? false;
  }

  public markPhaseDeployed(sourceModId: string, phase: number): void {
    this.ensurePhaseState(sourceModId);
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    phaseState.deployedPhases.add(phase);
  }

  // Schedule a deploy once all installers for a specific phase have finished
  public scheduleDeployOnPhaseSettled(
    api: IExtensionApi,
    sourceModId: string,
    phase: number,
    deployOnSettle?: boolean,
  ): Promise<void> | undefined {
    this.ensurePhaseState(sourceModId);
    const state = this.mInstallPhaseState.get(sourceModId);
    if (state.deployedPhases.has(phase)) {
      // Phase already deployed, nothing to do
      return;
    }

    // Only schedule deployment for phases that are allowed to be processed
    if (state.allowedPhase !== undefined && phase > state.allowedPhase) {
      return;
    }

    if (state.deploymentPromises?.has(phase)) {
      const existing = state.deploymentPromises.get(phase);
      if (deployOnSettle && !existing?.deployOnSettle) {
        state.deploymentPromises.set(phase, {
          deploymentPromise: existing.deploymentPromise,
          deployOnSettle: true,
        });
      }
      // Return the existing promise so callers can await it
      return existing?.deploymentPromise;
    }

    // Track deployment promise so we can wait for it before cleanup
    // Convert Bluebird to native Promise for compatibility
    const deploymentPromise = Promise.resolve(
      this.pollPhaseSettlement(api, sourceModId, { phase })
        .catch((err) => {
          log("warn", "Error during scheduled phase deployment", {
            sourceModId,
            phase,
            error: err?.message,
          });
        })
        .finally(() => {
          // Remove this promise from the array when it completes
          const phaseState = this.mInstallPhaseState.get(sourceModId);
          if (phaseState?.deploymentPromises) {
            phaseState.deploymentPromises.delete(phase);
          }
        }),
    );

    // Add to tracked deployment promises
    if (!state.deploymentPromises) {
      state.deploymentPromises = new Map<number, IDeploymentDetails>();
    }
    state.deploymentPromises.set(phase, {
      deploymentPromise,
      deployOnSettle: deployOnSettle ?? false,
    });
    return deploymentPromise;
  }

  // Called when downloads for a phase have been queued/processed
  private markPhaseDownloadsFinished(
    sourceModId: string,
    phase: number,
    api: IExtensionApi,
  ) {
    this.ensurePhaseState(sourceModId);
    const state = this.mInstallPhaseState.get(sourceModId);
    state.downloadsFinished.add(phase);

    // Initialize allowed phase to the first finished phase if not set
    if (state.allowedPhase === undefined) {
      state.allowedPhase = phase;
      // When setting initial allowed phase, mark all previous phases as downloads finished
      // since we can't be in phase N without having completed phases 0 through N-1
      for (let p = 0; p < phase; p++) {
        state.downloadsFinished.add(p);
      }
      this.startPendingForPhase(sourceModId, phase);
    }

    this.maybeAdvancePhase(sourceModId, api);
  }

  private startPendingForPhase(sourceModId: string, phase: number) {
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    if (!phaseState) {
      // Phase state was cleaned up, nothing to start
      return;
    }

    const tasks = phaseState.pendingByPhase.get(phase) ?? [];
    if (tasks.length === 0 || !this.canStartInstallationTasks(sourceModId)) {
      return;
    }
    // Drain queue for this phase
    phaseState.pendingByPhase.set(phase, []);
    tasks.forEach((run) => run());
  }

  private canStartInstallationTasks(
    sourceModId: string,
    allowOptional?: boolean,
  ): boolean {
    const state = this.mApi.getState();
    const installWhileDownloading = getSafe(
      state,
      ["settings", "downloads", "collectionsInstallWhileDownloading"],
      false,
    );
    if (installWhileDownloading) {
      return true;
    }
    const batchContext = getBatchContext(
      ["install-dependencies", "install-recommendations"],
      "",
    );
    const profileId =
      batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
    const sessionId = generateCollectionSessionId(sourceModId, profileId);
    if (!sessionId) {
      // No active collection session, allow installations.
      return true;
    }
    const breakdown = getCollectionStatusBreakdown(state, sessionId);
    const relevant =
      allowOptional === true ? breakdown.total : breakdown.required;
    const pending = Object.entries(relevant).reduce((sum, [status, value]) => {
      if (["pending", "downloading"].includes(status)) {
        return sum + value;
      }
      return sum;
    }, 0);

    return pending === 0;
  }

  private maybeAdvancePhase(sourceModId: string, api: IExtensionApi) {
    const state = this.mApi.getState();
    const phaseState = this.mInstallPhaseState.get(sourceModId);
    if (!phaseState) {
      // Phase state was cleaned up, nothing to advance
      return;
    }

    if (phaseState.allowedPhase === undefined) {
      log("debug", "phase gating: awaiting first finished phase", {
        sourceModId,
      });
      return;
    }

    // Clean up inappropriate phase state - clear re-queue attempts for phases beyond allowed
    if (phaseState.reQueueAttempted) {
      Array.from(phaseState.reQueueAttempted.keys()).forEach((phase) => {
        if (phase > phaseState.allowedPhase) {
          phaseState.reQueueAttempted.delete(phase);
          log("debug", "Cleared re-queue attempt for future phase", {
            sourceModId,
            phase,
            allowedPhase: phaseState.allowedPhase,
          });
        }
      });
    }
    // Try to advance through finished phases where there are no active installs
    let curr = phaseState.allowedPhase;
    while (
      phaseState.downloadsFinished.has(curr) &&
      (phaseState.activeByPhase.get(curr) ?? 0) === 0 &&
      (phaseState.pendingByPhase.get(curr) ?? []).length === 0
    ) {
      // Check if the phase is actually complete according to collection session
      const collectionStatus = this.checkCollectionPhaseStatus(
        api,
        sourceModId,
        curr,
      );
      if (!collectionStatus.phaseComplete) {
        this.startPendingForPhase(sourceModId, curr);
        break;
      }

      // Determine previous finished phase (by order in downloadsFinished)
      const finished = Array.from(phaseState.downloadsFinished).sort(
        (a, b) => a - b,
      );
      const currIdx = finished.findIndex((p) => p === curr);
      // Only advance past curr if the current phase has been deployed
      if (!phaseState.deployedPhases.has(curr)) {
        log(
          "debug",
          "phase gating: phase complete but not deployed, scheduling deployment",
          { sourceModId, currPhase: curr },
        );
        // Schedule deployment to mark the phase as deployed when it settles
        this.scheduleDeployOnPhaseSettled(api, sourceModId, curr);
        // Start any pending installations for this phase to avoid deadlocks
        this.startPendingForPhase(sourceModId, curr);
        break;
      }
      // Start any pending installs for this phase (if not already started)
      this.startPendingForPhase(sourceModId, curr);
      // Move to next finished phase if any
      const nextIdx = currIdx + 1;
      if (nextIdx < finished.length) {
        curr = finished[nextIdx];
        phaseState.allowedPhase = curr;
        this.startPendingForPhase(sourceModId, curr);

        // When advancing to a new phase, scan for any finished downloads that should be queued
        const apiState = api.getState();
        const batchContext = getBatchContext(
          ["install-dependencies", "install-recommendations"],
          "",
        );
        const profileId =
          batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
        const gameId = profileById(apiState, profileId)?.gameId;
        if (!gameId) {
          continue;
        }
        const downloads = apiState.persistent.downloads.files;
        const mods = apiState.persistent.mods[gameId] || {};
        const collectionMod = mods[sourceModId];

        // We can't rely on the collection installation tracking for this since
        // the state might not be accurate if the app was restarted or if the
        // state has yet to be updated.
        if (collectionMod?.rules) {
          collectionMod.rules.forEach((rule: any) => {
            const rulePhase = rule.extra?.phase ?? 0;
            if (rulePhase === curr && rule.reference?.tag) {
              const downloadId = getReadyDownloadId(
                downloads,
                rule.reference,
                (id) => this.hasActiveOrPendingInstallation(sourceModId, id),
              );

              if (downloadId) {
                this.handleDownloadFinished(api, downloadId, sourceModId);
              }
            }
          });
        }

        continue;
      }
      break;
    }
  }

  /**
   * when installing a mod from a dependency rule we store the id of the installed mod
   * in the rule for quicker and consistent matching but if - at a later time - we
   * install those same dependencies again we have to unset those ids, otherwise the
   * dependency installs would fail.
   */
  private repairRules(api: IExtensionApi, mod: IMod, gameId: string) {
    const state: IState = api.store.getState();
    const mods = state.persistent.mods[gameId];

    (mod.rules || []).forEach((rule) => {
      if (
        rule.reference.id !== undefined &&
        mods[rule.reference.id] === undefined &&
        this.hasFuzzyReference(rule.reference)
      ) {
        const newRule: IModRule = JSON.parse(JSON.stringify(rule));
        api.store.dispatch(removeModRule(gameId, mod.id, rule));
        delete newRule.reference.id;
        api.store.dispatch(addModRule(gameId, mod.id, newRule));
      }
    });
  }

  private isBrowserAssistantError(error: string): boolean {
    return (
      process.platform === "win32" &&
      error.indexOf("Roaming\\Browser Assistant") !== -1
    );
  }

  private isFileInUse(errorMessage: string, errorCode?: string): boolean {
    if (errorCode && ["EBUSY", "EPERM", "EACCES"].includes(errorCode)) {
      return true;
    }
    const lowered = errorMessage.toLowerCase();
    const patterns = [
      "being used by another process",
      "locked by another process",
      "denied",
      "cannot open",
      "can not open",
    ];
    return patterns.some((pattern) => lowered.includes(pattern));
  }

  private isCritical(errorMessage: string): boolean {
    // Don't treat file-in-use errors as critical - they can be retried
    if (this.isFileInUse(errorMessage)) {
      return false;
    }
    const lowered = errorMessage.toLowerCase();
    const patterns = ["unexpected end of archive", "error: data error"];
    return patterns.some((pattern) => lowered.includes(pattern));
  }

  private extractWithRetry(
    zip: Zip,
    archivePath: string,
    tempPath: string,
    progress: (files: string[], percent: number) => void,
    queryPassword: () => Bluebird<string>,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
  ): Bluebird<{ code: number; errors: string[] }> {
    const attemptExtract = (
      retriesLeft: number,
    ): Bluebird<{ code: number; errors: string[] }> => {
      const retryIfFileInUse = (errorMessages: string[]) => {
        if (
          retriesLeft > 0 &&
          errorMessages.some((msg) => this.isFileInUse(msg))
        ) {
          log("info", "archive file in use, retrying extraction", {
            archivePath: path.basename(archivePath),
            retriesLeft,
            retryDelayMs,
          });
          return delay(retryDelayMs).then(() =>
            attemptExtract(retriesLeft - 1),
          );
        }
        return undefined;
      };

      // DEBUG: Force random errors at 10% rate for testing
      // if (Math.random() < 0.1) {
      //   const errors = [
      //     () =>
      //       new ArchiveBrokenError(
      //         path.basename(archivePath),
      //         "debug test error",
      //       ),
      //     () => { const e = new Error("EPERM: operation not permitted"); (e as any).code = "EPERM"; (e as any).path = archivePath; return e; },
      //     () => new ProcessCanceled("debug canceled"),
      //     () => { const e = new Error("ENOENT: no such file or directory"); (e as any).code = "ENOENT"; (e as any).path = archivePath; return e; },
      //   ];
      //   return Bluebird.reject(
      //     errors[Math.floor(Math.random() * errors.length)](),
      //   );
      // }
      // clean up any stale temp directory from a previous failed attempt
      return fs.removeAsync(tempPath).then(() =>
        zip
          .extractFull(
            archivePath,
            tempPath,
            { ssc: false },
            progress,
            queryPassword as any,
          )
          .then((result: { code: number; errors: string[] }) => {
            // 7z can resolve (not reject) with a non-zero exit code and
            // file-in-use errors. Retry in that case instead of proceeding
            // with a partial extraction.
            if (result.code !== 0) {
              return retryIfFileInUse(result.errors ?? []) ?? result;
            }
            return result;
          })
          .catch((err) => {
            const error = unknownToError(err);
            return (
              retryIfFileInUse([error.message]) ??
              (this.isCritical(error.message)
                ? Bluebird.reject(
                    new ArchiveBrokenError(
                      path.basename(archivePath),
                      error.message,
                    ),
                  )
                : Bluebird.reject(error))
            );
          }),
      );
    };
    return attemptExtract(maxRetries);
  }

  /**
   * find the right installer for the specified archive, then install
   */
  private installInner(
    api: IExtensionApi,
    archivePath: string,
    tempPath: string,
    destinationPath: string,
    gameId: string,
    installContext: IInstallContext,
    installationZip: Zip,
    forceInstaller?: string,
    installChoices?: any,
    extractList?: IFileListItem[],
    unattended?: boolean,
    details?: IInstallationDetails,
  ): Bluebird<IInstallResult> {
    const fileList: string[] = [];
    let phase = "Extracting";

    const progress = (files: string[], percent: number) => {
      if (percent !== undefined && installContext !== undefined) {
        installContext.setProgress(phase, percent);
      }
    };
    log("debug", "extracting mod archive", { archivePath, tempPath });
    let extractProm: Bluebird<any>;
    const extractionStart = Date.now();
    if (FILETYPES_AVOID.includes(path.extname(archivePath).toLowerCase())) {
      extractProm = Bluebird.reject(
        new ArchiveBrokenError(
          path.basename(archivePath),
          "file type on avoidlist",
        ),
      );
    } else {
      extractProm = this.extractWithRetry(
        installationZip,
        archivePath,
        tempPath,
        progress,
        () => this.queryPassword(api.store),
      );
      (extractProm as any).startTime = extractionStart;
    }

    return extractProm
      .then(async ({ code, errors }: { code: number; errors: string[] }) => {
        log("debug", "extraction completed", {
          archivePath: path.basename(archivePath),
          extractionTimeMs: Date.now() - (extractProm as any).startTime,
        });
        phase = "Installing";
        if (installContext !== undefined) {
          installContext.setProgress("Installing");
        }
        if (code !== 0) {
          log("warn", "extraction reported error", {
            code,
            errors: errors.join("; "),
          });
          // 7z exit codes: 0=OK, 1=Warning, 2=Fatal, 7=CLI error, 8=OOM,
          // 255=User stopped. Note that 2 can also be raised for file-in-use
          // which is retryable so we can't treat it as critical.
          const critical = errors.find((err) => this.isCritical(err));
          if (critical !== undefined) {
            throw new ArchiveBrokenError(path.basename(archivePath), critical);
          }
          await this.queryContinue(api, errors, archivePath);
        }
      })
      .then(async () => {
        await walk(
          tempPath,
          toBluebird(async (iterPath, stats) => {
            if (stats.isFile()) {
              fileList.push(path.relative(tempPath, iterPath));
            } else {
              // unfortunately we also have to pass directories because
              // some mods contain empty directories to control stop-folder
              // management...
              fileList.push(path.relative(tempPath, iterPath) + path.sep);
            }
          }),
        );
      })
      .then(async () => {
        const hasFomodSegment = (file: string) => {
          const segments = file.toLowerCase().split(path.sep);
          return segments.includes("fomod");
        };
        const hasCSScripts = fileList.some(
          (file) =>
            hasFomodSegment(file) &&
            ["script.cs"].includes(path.basename(file).toLowerCase()),
        );
        const hasXmlConfigXML = fileList.some(
          (file) =>
            hasFomodSegment(file) &&
            ["moduleconfig.xml", "script.xml"].includes(
              path.basename(file).toLowerCase(),
            ),
        );
        const testDetails: ITestSupportedDetails = {
          hasCSScripts,
          hasXmlConfigXML,
        };

        const allowList = getCSharpScriptAllowListForGame(gameId);
        if (
          hasCSScripts &&
          !allowList.has(details?.modReference?.repo?.modId || "")
        ) {
          const modName =
            details?.modReference?.id ||
            path.basename(archivePath, path.extname(archivePath));
          const t = api.translate;

          const no = t("Cancel installation");
          const yes = t("Install anyway (unsafe)");
          //const yesForAll = t(`Install anyway (unsafe). Don't ask again for the current session`);
          const dialogResult = await api.showDialog?.(
            "question",
            t(`Unsafe Mod Detected`),
            {
              bbcode: t(
                `"{{modName}}" contains C# scripts that can run code on your computer.[br][/br][br][/br]` +
                  `These scripts give the mod full access to your system and can cause serious harm, including data loss or security breaches.[br][/br]` +
                  `Unless you personally reviewed and trust the source, we strongly recommend you do not install this mod.[br][/br][br][/br]` +
                  `Are you sure you want to continue?`,
                { replace: { modName: modName } },
              ),
            },
            [{ label: no }, { label: yes } /*{ label: yesForAll }*/],
          );
          switch (dialogResult?.action) {
            case no:
              throw new UserCanceled();
            //case yesForAll:
            //  break;
          }
        }

        if (truthy(extractList) && extractList.length > 0) {
          const supportedInstaller = await makeListInstaller(
            extractList,
            tempPath,
          );
          return { ...supportedInstaller, ...testDetails };
        } else if (forceInstaller === undefined) {
          const supportedInstaller = await this.getInstaller(
            fileList,
            gameId,
            archivePath,
            undefined,
            testDetails,
          );
          return { ...supportedInstaller, ...testDetails };
        } else {
          const forced = this.mInstallers.find(
            (inst) => inst.id === forceInstaller,
          );
          const testResult = await forced.testSupported(
            fileList,
            gameId,
            archivePath,
            testDetails,
          );

          if (!testResult.supported) {
            return undefined;
          } else {
            return {
              installer: forced,
              requiredFiles: testResult.requiredFiles,
              ...testDetails,
            };
          }
        }
      })
      .then(async (supportedInstaller) => {
        if (supportedInstaller === undefined) {
          throw new Error("no installer supporting this file");
        }

        const { installer, requiredFiles } = supportedInstaller;
        const overrideInstructionsFilePresentInArchive = fileList.some(
          (file) =>
            path.basename(file) === VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
        );
        const innerDetails: IInstallationDetails = {
          hasInstructionsOverrideFile: overrideInstructionsFilePresentInArchive,
          modReference: details?.modReference,
          hasCSScripts: supportedInstaller?.hasCSScripts,
          hasXmlConfigXML: supportedInstaller?.hasXmlConfigXML,
        };
        log("debug", "invoking installer", {
          installer: installer.id,
          enforced: forceInstaller !== undefined,
        });
        const installerResult = await installer.install(
          fileList,
          tempPath,
          gameId,
          (perc: number) => {
            log("info", "progress", perc);
            progress([], perc);
          },
          installChoices,
          unattended,
          archivePath,
          innerDetails,
        );
        if (!installerResult.instructions) {
          return installerResult;
        }

        const overrideCopyInstructionExists = installerResult.instructions.some(
          (instr) =>
            instr.type === "copy" &&
            instr.source === VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
        );

        if (
          overrideInstructionsFilePresentInArchive &&
          !overrideCopyInstructionExists
        ) {
          installerResult.instructions.push({
            type: "copy",
            source: VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
            destination: VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME,
          });
        }
        return installerResult;
      });
  }

  private determineModType(
    gameId: string,
    installInstructions: IInstruction[],
  ): Bluebird<string> {
    log("info", "determine mod type", { gameId });
    const game = getGame(gameId);
    if (game === undefined) {
      return Bluebird.reject(new Error(`Invalid game "${gameId}"`));
    }
    const modTypes: IModType[] = game.modTypes;
    const sorted = modTypes.sort((lhs, rhs) => lhs.priority - rhs.priority);
    let found = false;

    return Bluebird.mapSeries(sorted, (type: IModType): Bluebird<string> => {
      if (found) {
        return Bluebird.resolve<string>(null);
      }

      try {
        return type.test(installInstructions).then((matches) => {
          if (matches) {
            found = true;
            return Bluebird.resolve(type.typeId);
          } else {
            return Bluebird.resolve(null);
          }
        });
      } catch (err) {
        log("error", "invalid mod type", {
          typeId: type.typeId,
          error: getErrorMessageOrDefault(err),
        });
        return Bluebird.resolve(null);
      }
    }).then((matches) => matches.find((match) => match !== null) || "");
  }

  private queryContinue(
    api: IExtensionApi,
    errors: string[],
    archivePath: string,
  ): Bluebird<void> {
    const terminal = errors.find(
      (err) => err.indexOf("Can not open the file as archive") !== -1,
    );

    return new Bluebird<void>((resolve, reject) => {
      const actions = [
        { label: "Cancel", action: () => reject(new UserCanceled()) },
        {
          label: "Delete",
          action: () => {
            fs.removeAsync(archivePath)
              .catch((err) =>
                api.showErrorNotification("Failed to remove archive", err, {
                  allowReport: false,
                }),
              )
              .finally(() => {
                const { files } = api.getState().persistent.downloads;
                const dlId = Object.keys(files).find(
                  (iter) =>
                    files[iter].localPath === path.basename(archivePath),
                );
                if (dlId !== undefined) {
                  api.store.dispatch(removeDownload(dlId));
                }
                reject(new UserCanceled());
              });
          },
        },
      ];

      if (!terminal) {
        actions.push({ label: "Continue", action: () => resolve() });
      }

      const title = api.translate('Archive damaged "{{archiveName}}"', {
        replace: { archiveName: path.basename(archivePath) },
      });
      api.store.dispatch(
        showDialog(
          "error",
          title,
          {
            bbcode: api.translate(
              "Encountered errors extracting this archive. Please verify this " +
                "file was downloaded correctly.\n[list]{{ errors }}[/list]",
              {
                replace: { errors: errors.map((err) => "[*] " + err) },
              },
            ),
            options: { translated: true },
          },
          actions,
        ),
      );
    });
  }

  private queryPassword(store: ThunkStore<any>): Bluebird<string> {
    return new Bluebird<string>((resolve, reject) => {
      store
        .dispatch(
          showDialog(
            "info",
            "Password Protected",
            {
              input: [
                {
                  id: "password",
                  type: "password",
                  value: "",
                  label: "A password is required to extract this archive",
                },
              ],
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          ),
        )
        .then((result: IDialogResult) => {
          if (result.action === "Continue") {
            resolve(result.input["password"]);
          } else {
            reject(new UserCanceled());
          }
        });
    });
  }

  private validateInstructions(
    instructions: IInstruction[],
  ): IInvalidInstruction[] {
    const sanitizeSep = new RegExp("/", "g");
    // Validate the ungrouped instructions and return errors (if any)
    const invalidDestinationErrors: IInvalidInstruction[] = instructions
      .filter((instr) => {
        if (instr.destination) {
          // This is a temporary hack to avoid invalidating fomod instructions
          //  which will include a path separator at the beginning of a relative path
          //  when matching nested stop patterns.
          const destination =
            instr.destination.charAt(0) === path.sep
              ? instr.destination.substr(1)
              : instr.destination;

          // Ensure we use windows path separators as scripted installers
          //  will sometime return *nix separators.
          const sanitized =
            process.platform === "win32"
              ? destination.replace(sanitizeSep, path.sep)
              : destination;
          return !isPathValid(sanitized, true);
        }

        return false;
      })
      .map((instr) => {
        return {
          type: instr.type,
          error: `invalid destination path: "${instr.destination}"`,
        };
      });

    return [].concat(invalidDestinationErrors);
  }

  private transformInstructions(input: IInstruction[]): InstructionGroups {
    return input.reduce((prev, value) => {
      if (truthy(value) && prev[value.type] !== undefined) {
        prev[value.type].push(value);
      }
      return prev;
    }, new InstructionGroups());
  }

  private reportUnsupported(
    api: IExtensionApi,
    unsupported: IInstruction[],
    archivePath: string,
  ) {
    if (unsupported.length === 0) {
      return;
    }
    const missing = unsupported.map((instruction) => instruction.source);
    const makeReport = () =>
      api
        .genMd5Hash(archivePath)
        .catch((err) => ({}))
        .then((hashResult: IHashResult) =>
          createErrorReport(
            "Installer failed",
            {
              message: "The installer uses unimplemented functions",
              details:
                `Missing instructions: ${missing.join(", ")}\n` +
                `Installer name: ${path.basename(archivePath)}\n` +
                `MD5 checksum: ${hashResult.md5sum}\n`,
            },
            {},
            ["installer"],
            api.store.getState(),
          ),
        );
    const showUnsupportedDialog = () =>
      api.store.dispatch(
        showDialog(
          "info",
          "Installer unsupported",
          {
            message:
              "This installer is (partially) unsupported as it's " +
              "using functionality that hasn't been implemented yet. " +
              "Please help us fix this by submitting an error report with a link to this mod.",
          },
          isOutdated() || didIgnoreError()
            ? [{ label: "Close" }]
            : [{ label: "Report", action: makeReport }, { label: "Close" }],
        ),
      );

    api.sendNotification({
      type: "info",
      message: "Installer unsupported",
      actions: [{ title: "More", action: showUnsupportedDialog }],
    });
  }

  private processMKDir(
    instructions: IInstruction[],
    destinationPath: string,
  ): Bluebird<void> {
    return Bluebird.each(instructions, (instruction) =>
      fs.ensureDirAsync(path.join(destinationPath, instruction.destination)),
    ).then(() => undefined);
  }

  private processGenerateFiles(
    generatefile: IInstruction[],
    destinationPath: string,
  ): Bluebird<void> {
    return Bluebird.each(generatefile, (gen) => {
      const outputPath = path.join(destinationPath, gen.destination);
      return (
        fs
          .ensureDirAsync(path.dirname(outputPath))
          // data buffers are sent to us base64 encoded
          .then(() => fs.writeFileAsync(outputPath, gen.data))
      );
    }).then(() => undefined);
  }

  private processSubmodule(
    api: IExtensionApi,
    installContext: InstallContext,
    submodule: IInstruction[],
    destinationPath: string,
    gameId: string,
    modId: string,
    choices: any,
    unattended: boolean,
    details: IInstallationDetails,
  ): Bluebird<void> {
    return Bluebird.each(submodule, (mod) => {
      const tempPath = destinationPath + "." + shortid() + ".installing";
      log("debug", "install submodule", {
        modPath: mod.path,
        tempPath,
        destinationPath,
      });
      const subContext = new InstallContext(gameId, api, unattended);
      subContext.startIndicator(
        api.translate("nested: {{modName}}", {
          replace: { modName: path.basename(mod.path) },
        }),
      );
      const submoduleZip = new Zip();
      return this.installInner(
        api,
        mod.path,
        tempPath,
        destinationPath,
        gameId,
        subContext,
        submoduleZip,
        undefined,
        choices,
        undefined,
        unattended,
        details,
      )
        .then((resultInner) =>
          this.processInstructions(
            api,
            installContext,
            mod.path,
            tempPath,
            destinationPath,
            gameId,
            modId,
            resultInner,
            choices,
            unattended,
            details,
          ),
        )
        .then(() => {
          if (mod.submoduleType !== undefined) {
            api.store.dispatch(setModType(gameId, modId, mod.submoduleType));
          }
        })
        .finally(() => {
          subContext.finishInstallCB("ignore");
          subContext.stopIndicator();
          log("debug", "removing submodule", tempPath);
          fs.removeAsync(tempPath);
        });
    }).then(() => undefined);
  }

  private processAttribute(
    api: IExtensionApi,
    attribute: IInstruction[],
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    attribute.forEach((attr) => {
      api.store.dispatch(setModAttribute(gameId, modId, attr.key, attr.value));
    });
    return Bluebird.resolve();
  }

  private processEnableAllPlugins(
    api: IExtensionApi,
    enableAll: IInstruction[],
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    if (enableAll.length > 0) {
      api.store.dispatch(
        setModAttribute(gameId, modId, "enableallplugins", true),
      );
    }
    return Bluebird.resolve();
  }

  private processSetModType(
    api: IExtensionApi,
    installContext: InstallContext,
    types: IInstruction[],
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    if (types.length > 0) {
      const type = types[types.length - 1].value;
      installContext.setModType(modId, type);
      api.store.dispatch(setModType(gameId, modId, type));
      if (types.length > 1) {
        log("error", "got more than one mod type, only the last was used", {
          types,
        });
      }
    }
    return Bluebird.resolve();
  }

  private processRule(
    api: IExtensionApi,
    rules: IInstruction[],
    gameId: string,
    modId: string,
  ): void {
    const batched = rules.reduce((acc, rule) => {
      acc.push(addModRule(gameId, modId, rule.rule));
      return acc;
    }, []);
    batchDispatch(api.store, batched);
  }

  private processIniEdits(
    api: IExtensionApi,
    iniEdits: IInstruction[],
    destinationPath: string,
    gameId: string,
    modId: string,
  ): Bluebird<void> {
    if (iniEdits.length === 0) {
      return Bluebird.resolve();
    }

    const byDest: { [dest: string]: IInstruction[] } = iniEdits.reduce(
      (prev: { [dest: string]: IInstruction[] }, value) => {
        setdefault(prev, value.destination, []).push(value);
        return prev;
      },
      {},
    );

    return fs
      .ensureDirAsync(path.join(destinationPath, INI_TWEAKS_PATH))
      .then(() =>
        Bluebird.map(Object.keys(byDest), (destination) => {
          const bySection: { [section: string]: IInstruction[] } = byDest[
            destination
          ].reduce((prev: { [section: string]: IInstruction[] }, value) => {
            setdefault(prev, value.section, []).push(value);
            return prev;
          }, {});

          const renderKV = (instruction: IInstruction): string =>
            `${instruction.key} = ${instruction.value}`;

          const renderSection = (section: string) =>
            [`[${section}]`]
              .concat(bySection[section].map(renderKV))
              .join(os.EOL);

          const content = Object.keys(bySection)
            .map(renderSection)
            .join(os.EOL);

          const basename = path.basename(
            destination,
            path.extname(destination),
          );
          const tweakId = `From Installer [${basename}].ini`;
          api.store.dispatch(setINITweakEnabled(gameId, modId, tweakId, true));

          return fs.writeFileAsync(
            path.join(destinationPath, INI_TWEAKS_PATH, tweakId),
            content,
          );
        }),
      )
      .then(() => undefined);
  }

  private modTypeExists = (gameId: string, modType: string): boolean => {
    if (!modType || !gameId) {
      return false;
    }
    const game = getGame(gameId);
    if (game === undefined) {
      return false;
    }
    return game.modTypes.some((type) => type.typeId === modType);
  };
  private processInstructions(
    api: IExtensionApi,
    installContext: InstallContext,
    archivePath: string,
    tempPath: string,
    destinationPath: string,
    gameId: string,
    modId: string,
    result: {
      instructions: IInstruction[];
      overrideInstructions?: IInstruction[];
    },
    choices: any,
    unattended: boolean,
    details: IInstallationDetails,
  ) {
    if (result.instructions === null) {
      // this is the signal that the installer has already reported what went
      // wrong. Not necessarily a "user canceled" but the error handling happened
      // in the installer so we don't know what happened.
      return Bluebird.reject(new UserCanceled());
    }

    if (result.instructions === undefined || result.instructions.length === 0) {
      return Bluebird.reject(
        new ProcessCanceled("Empty archive or no options selected"),
      );
    }

    const isActivityRunning = (activity: string) =>
      getSafe(
        api.getState(),
        ["session", "base", "activity", "mods"],
        [],
      ).includes(activity); // purge/deploy
    if (isActivityRunning("installing_dependencies")) {
      // we don't want to override any instructions when installing as part of a collection!
      //  this will just add extra complexity to an already complex process.
      result.overrideInstructions = [];
    }
    const overrideMap = new Map<string, IInstruction>();
    result.overrideInstructions?.forEach((instr) => {
      let key = instr.source ?? instr.type;
      if (key == null) {
        return;
      }
      key = key.toUpperCase();
      if (
        instr.type !== "setmodtype" ||
        this.modTypeExists(gameId, instr?.value)
      ) {
        overrideMap.set(key, instr);
      } else {
        log("warn", "mod type does not exist", instr);
      }
    });

    const finalInstructions = result.instructions
      .filter((instr) => (instr.source ?? instr.type) != null)
      .map((instr) => {
        const key = (instr.source ?? instr.type).toUpperCase();
        const overrideEntry = overrideMap.get(key);
        if (overrideEntry) {
          log("debug", "overriding instruction", {
            key,
            type: instr.type,
            override: JSON.stringify(overrideEntry),
          });
        }
        return overrideEntry ?? instr;
      });

    // Add instructions from result.overrideInstructions that are not already present in finalInstructions
    if (Array.isArray(result.overrideInstructions)) {
      const existingKeys = new Set(
        finalInstructions.map((instr) =>
          (instr.source ?? instr.type).toUpperCase(),
        ),
      );
      for (const instr of result.overrideInstructions) {
        let key = instr.source ?? instr.type;
        if (key == null) {
          continue;
        }
        key = key.toUpperCase();
        // For copy instructions, ensure no duplicate destinations
        if (instr.type === "copy") {
          const isDuplicate = finalInstructions.some(
            (existingInstr) =>
              existingInstr.type === "copy" &&
              existingInstr.destination === instr.destination,
          );
          if (isDuplicate) {
            // The assumption here is that the override instruction does not contain
            //  the correct source information so we use the original instruction
            continue;
          }
        }
        if (
          !existingKeys.has(key) &&
          (instr.type !== "setmodtype" ||
            this.modTypeExists(gameId, instr?.value))
        ) {
          finalInstructions.push(instr);
        }
      }
    }

    const invalidInstructions = this.validateInstructions(finalInstructions);
    if (invalidInstructions.length > 0) {
      const game = getGame(gameId);
      // we can also get here with invalid instructions from scripted installers
      // so even if the game is not contributed, this is still probably not a bug
      // const allowReport = (game.contributed === undefined);
      const allowReport = false;
      const error = allowReport
        ? 'Invalid installer instructions found for "{{ modId }}".'
        : 'Invalid installer instructions found for "{{ modId }}". Please inform ' +
          'the game extension\'s developer - "{{ contributor }}", or the mod author.';
      api.showErrorNotification(
        "Invalid mod installer instructions",
        {
          invalid:
            "\n" +
            invalidInstructions
              .map((inval) => `(${inval.type}) - ${inval.error}`)
              .join("\n"),
          message: error,
        },
        {
          replace: {
            modId,
            contributor: game.contributed,
          },
          allowReport,
        },
      );
      return Bluebird.reject(
        new ProcessCanceled("Invalid installer instructions"),
      );
    }

    const instructionGroups = this.transformInstructions(finalInstructions);

    if (instructionGroups.error.length > 0) {
      const fatal = instructionGroups.error.find(
        (err) => err.value === "fatal",
      );
      let error =
        'Errors were reported processing the installer for "{{ modId }}". ';

      if (fatal === undefined) {
        error +=
          "It's possible the mod works (partially) anyway. " +
          "Please note that NMM tends to ignore errors so just because NMM doesn't " +
          "report a problem with this installer doesn't mean it doesn't have any.";
      }

      api.showErrorNotification(
        "Installer reported errors",
        error + "\n{{ errors }}",
        {
          replace: {
            errors: instructionGroups.error.map((err) => err.source).join("\n"),
            modId,
          },
          allowReport: false,
          message: modId,
        },
      );
      if (fatal !== undefined) {
        const errorMessages = instructionGroups.error.map((err) => err.source);
        const errorSummary = errorMessages.join("; ");
        return Bluebird.reject(
          new ProcessCanceled(`Installer script failed: ${errorSummary}`, {
            modId,
            errors: instructionGroups.error.map((err) => ({
              severity: err.value,
              message: err.source,
            })),
          }),
        );
      }
    }

    // log('debug', 'installer instructions',
    //     JSON.stringify(result.instructions.map(instr => _.omit(instr, ['data']))));
    this.reportUnsupported(api, instructionGroups.unsupported, archivePath);

    return this.processMKDir(instructionGroups.mkdir, destinationPath)
      .then(() =>
        this.extractArchive(
          api,
          archivePath,
          tempPath,
          destinationPath,
          instructionGroups.copy,
          gameId,
        ),
      )
      .then(() =>
        this.processGenerateFiles(
          instructionGroups.generatefile,
          destinationPath,
        ),
      )
      .then(() =>
        this.processIniEdits(
          api,
          instructionGroups.iniedit,
          destinationPath,
          gameId,
          modId,
        ),
      )
      .then(() =>
        this.processSubmodule(
          api,
          installContext,
          instructionGroups.submodule,
          destinationPath,
          gameId,
          modId,
          choices,
          unattended,
          details,
        ),
      )
      .then(() =>
        this.processAttribute(api, instructionGroups.attribute, gameId, modId),
      )
      .then(() =>
        this.processEnableAllPlugins(
          api,
          instructionGroups.enableallplugins,
          gameId,
          modId,
        ),
      )
      .then(() =>
        this.processSetModType(
          api,
          installContext,
          instructionGroups.setmodtype,
          gameId,
          modId,
        ),
      )
      .then(() => {
        this.processRule(api, instructionGroups.rule, gameId, modId);
        return Bluebird.resolve();
      });
  }

  private checkModVariantsExist(
    api: IExtensionApi,
    gameMode: string,
    archiveId: string,
  ): string[] {
    if (archiveId === null) {
      return [];
    }
    const state = api.getState();
    const mods = Object.values(state.persistent.mods[gameMode] || []);
    return mods
      .filter((mod) => mod.archiveId === archiveId)
      .map((mod) => mod.id);
  }

  private checkModNameExists(
    installName: string,
    api: IExtensionApi,
    gameMode: string,
  ): string[] {
    const state = api.getState();
    const mods = Object.values(state.persistent.mods[gameMode] || []);
    // Yes I know that only 1 mod id can ever match the install name, but it's more consistent
    //  with the variant check as we don't have to check for undefined too.
    return mods.filter((mod) => mod.id === installName).map((mod) => mod.id);
  }

  private findPreviousVersionMod(
    fileId: number,
    store: Redux.Store<any>,
    gameMode: string,
    isCollection: boolean,
  ): IMod {
    const mods = store.getState().persistent.mods[gameMode] || {};
    // This is not great, but we need to differentiate between revisionIds and fileIds
    //  as it's perfectly possible for a collection's revision id to match a regular
    //  mod's fileId resulting in false positives and therefore mashed up metadata.
    const filterFunc = (modId: string) =>
      isCollection
        ? mods[modId].type === "collection"
        : mods[modId].type !== "collection";
    let mod: IMod;
    Object.keys(mods)
      .filter(filterFunc)
      .forEach((key) => {
        // TODO: fileId/revisionId can potentially be more up to date than the last
        //  known "newestFileId" property if the curator/mod author has released a new
        //  version of his collection/mod since the last time the user checked for updates
        const newestFileId: number = mods[key].attributes?.newestFileId;
        const currentFileId: number =
          mods[key].attributes?.fileId ?? mods[key].attributes?.revisionId;
        if (newestFileId !== currentFileId && newestFileId === fileId) {
          mod = mods[key];
        }
      });

    return mod;
  }

  private queryIgnoreDependent(
    store: ThunkStore<any>,
    gameId: string,
    dependents: Array<{ owner: string; rule: IModRule }>,
  ): Bluebird<void> {
    const batchKey = "remember-ignore-dependent-action";
    let context = getBatchContext("install-mod", "", false);
    const handleAction = (action: string, remember: boolean) => {
      if (remember) {
        context = getBatchContext("install-mod", "", true);
        context?.set?.(batchKey, action);
      }
      if (action === "Cancel") {
        return Bluebird.reject(new UserCanceled());
      } else {
        const ruleActions = dependents.reduce((prev, dep) => {
          prev.push(removeModRule(gameId, dep.owner, dep.rule));
          prev.push(
            addModRule(gameId, dep.owner, {
              ...dep.rule,
              ignored: true,
            }),
          );
          return prev;
        }, []);
        batchDispatch(store, ruleActions);
        return Bluebird.resolve();
      }
    };
    return new Bluebird<void>((resolve, reject) => {
      const rememberAction = context?.get?.(batchKey, false);
      if (rememberAction) {
        // if we already have a remembered action, just resolve
        return handleAction(rememberAction, true)
          .then(() => resolve())
          .catch((err) => reject(err));
      }
      store
        .dispatch(
          showDialog(
            "question",
            "Updating may break dependencies",
            {
              text:
                "You're updating a mod that others depend upon and the update doesn't seem to " +
                "be compatible (according to the dependency information). " +
                "If you continue we have to disable these dependencies, otherwise you'll " +
                "continually get warnings about it.",
              options: { wrap: true },
              checkboxes: [
                {
                  id: "remember",
                  value: false,
                  text: "Remember my choice",
                },
              ],
            },
            [{ label: "Cancel" }, { label: "Ignore" }],
          ),
        )
        .then((result: IDialogResult) =>
          handleAction(result.action, result.input.remember)
            .then(() => resolve())
            .catch((err) => reject(err)),
        );
    });
  }

  private queryProfileCount(store: ThunkStore<any>): number {
    const state = store.getState();
    const profiles = gameProfiles(state);
    return profiles.length;
  }

  private userVersionChoice(
    oldMod: IMod,
    store: ThunkStore<any>,
  ): Bluebird<string> {
    const totalProfiles = this.queryProfileCount(store);
    const batchAction = "remember-user-version-choice-action";
    const handleAction = (action: string, remember: boolean) => {
      if (remember) {
        const context = getBatchContext("install-mod", "", true);
        context?.set?.(batchAction, action);
      }
      if (action === "Cancel") {
        return Bluebird.reject(new UserCanceled());
      } else if (action === REPLACE_ACTION) {
        return Bluebird.resolve(REPLACE_ACTION);
      } else if (action === INSTALL_ACTION) {
        return Bluebird.resolve(INSTALL_ACTION);
      }
    };

    const context = getBatchContext("install-mod", "", false);
    const rememberAction = context?.get?.(batchAction);
    return rememberAction
      ? Bluebird.resolve(rememberAction)
      : totalProfiles === 1
        ? Bluebird.resolve(REPLACE_ACTION)
        : new Bluebird<string>((resolve, reject) => {
            store
              .dispatch(
                showDialog(
                  "question",
                  modName(oldMod),
                  {
                    text:
                      "An older version of this mod is already installed. " +
                      "You can replace the existing one - which will update all profiles - " +
                      "or install this one alongside it. In the latter case both versions " +
                      "will be available and only the active profile will be updated. ",
                    options: { wrap: true },
                    checkboxes: [
                      {
                        id: "remember",
                        value: false,
                        text: "Remember my choice",
                      },
                    ],
                  },
                  [
                    { label: "Cancel" },
                    { label: REPLACE_ACTION },
                    { label: INSTALL_ACTION },
                  ],
                ),
              )
              .then((result: IDialogResult) =>
                handleAction(result.action, result.input.remember),
              )
              .then(resolve)
              .catch(reject);
          });
  }

  private queryUserReplace(
    api: IExtensionApi,
    modIds: string[],
    gameId: string,
    installOptions: IInstallOptions,
  ) {
    return new Bluebird<IReplaceChoice>((resolve, reject) => {
      const state: IState = api.store.getState();
      const mods: IMod[] = Object.values(state.persistent.mods[gameId]).filter(
        (mod) => modIds.includes(mod.id) && mod.state === "installed",
      );
      const batchContext = getBatchContext(
        ["install-dependencies", "install-recommendations"],
        "",
      );
      const profileId =
        batchContext?.get<string>("profileId") ?? activeProfile(state)?.id;
      const currentProfile = profileById(api.store.getState(), profileId);
      if (mods.length === 0) {
        // Technically for this to happen the timing must be *perfect*,
        //  the replace query dialog will only show if we manage to confirm that
        //  the modId is indeed stored persistently - but if somehow the user
        //  was able to finish removing the mod right as the replace dialog
        //  appears the mod could be potentially missing from the state.
        // In this case we resolve using the existing modId.
        // https://github.com/Nexus-Mods/Vortex/issues/7972
        return resolve({
          id: modIds[0],
          variant: "",
          enable: getSafe(
            currentProfile,
            ["modState", modIds[0], "enabled"],
            false,
          ),
          attributes: {},
          rules: [],
          replaceChoice: "replace",
        });
      }

      const context = getBatchContext("install-mod", mods[0].archiveId);

      const queryVariantNameDialog = (remember: boolean) => {
        const checkVariantRemember: ICheckbox[] = [];
        if (truthy(context)) {
          const itemsCompleted = context.get("items-completed", 0);
          const itemsLeft = context.itemCount - itemsCompleted;
          if (itemsLeft > 1 && remember) {
            checkVariantRemember.push({
              id: "remember",
              value: false,
              text: api.translate(
                "Use this name for all remaining variants ({{count}} more)",
                {
                  count: itemsLeft - 1,
                },
              ),
            });
          }
        }

        return api
          .showDialog(
            "question",
            "Install options - Name mod variant",
            {
              text: 'Enter a variant name for "{{modName}}" to differentiate it from the original',
              input: [
                {
                  id: "variant",
                  value:
                    installOptions.variantNumber > 2
                      ? installOptions.variantNumber.toString()
                      : "2",
                  label: "Variant",
                },
              ],
              checkboxes: checkVariantRemember,
              md:
                "**Remember:** You can switch between variants by clicking in the version " +
                "column in your mod list and selecting from the dropdown.",
              parameters: {
                modName: modName(mods[0], { version: false }),
              },
              condition: (content: IDialogContent) =>
                validateVariantName(api.translate, content),
              options: {
                order: ["text", "input", "md", "checkboxes"],
              },
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) => {
            if (result.action === "Cancel") {
              context?.set?.("canceled", true);
              return Bluebird.reject(new UserCanceled());
            } else {
              if (result.input.remember) {
                context.set("variant-name", result.input.variant);
              }
              return Bluebird.resolve(result.input.variant);
            }
          });
      };

      const mod = mods[0];
      const modReference: IModReference = {
        id: mod.id,
        fileList: installOptions?.fileList,
        archiveId: mod.archiveId,
        gameId,
        installerChoices: installOptions?.choices,
        patches: installOptions?.patches,
      };
      const isDependency =
        installOptions?.unattended === true &&
        testModReference(mods[0], modReference) === false;
      const addendum = isDependency
        ? " and is trying to be reinstalled as a dependency by another mod or collection."
        : ".";

      const queryDialog = () =>
        api
          .showDialog(
            "question",
            "Install options",
            {
              bbcode: api.translate(
                `"{{modName}}" is already installed on your system${addendum}` +
                  "[br][/br][br][/br]Would you like to:",
                { replace: { modName: modName(mods[0], { version: false }) } },
              ),
              choices: [
                {
                  id: "replace",
                  value: true,
                  text:
                    "Replace the existing mod" +
                    (isDependency ? " (recommended)" : ""),
                  subText:
                    "This will replace the existing mod on all your profiles.",
                },
                {
                  id: "variant",
                  value: false,
                  text: "Install as variant of the existing mod",
                  subText:
                    "This will allow you to install variants of the same mod and easily " +
                    "switch between them from the version drop-down in the mods table. " +
                    "This can be useful if you want to install the same mod but with " +
                    "different options in different profiles.",
                },
              ],
              checkboxes: checkRoVRemember,
              options: {
                wrap: true,
                order: ["choices", "checkboxes"],
              },
              parameters: {
                modName: modName(mods[0], { version: false }),
              },
            },
            [{ label: "Cancel" }, { label: "Continue" }],
          )
          .then((result) => {
            if (result.action === "Cancel") {
              context?.set?.("canceled", true);
              return Bluebird.reject(new UserCanceled());
            } else if (result.input.variant) {
              return queryVariantNameDialog(result.input.remember).then(
                (variant) => ({
                  action: "variant",
                  variant,
                  remember: result.input.remember,
                }),
              );
            } else if (result.input.replace) {
              return {
                action: "replace",
                remember: result.input.remember,
              };
            }
          });

      const queryVariantReplacement = () =>
        api.showDialog(
          "question",
          "Select Variant to Replace",
          {
            text: '"{{modName}}" has several variants installed - please choose which one to replace:',
            choices: mods.map((mod, idx) => {
              const modAttributes = mod.attributes;
              const variant = getSafe(modAttributes, ["variant"], "");
              return {
                id: mod.id,
                value: idx === 0,
                text: `modId: ${mod.id}`,
                subText: api.translate(
                  "Version: {{version}}; InstallTime: {{installTime}}; Variant: {{variant}}",
                  {
                    replace: {
                      version: getSafe(modAttributes, ["version"], "Unknown"),
                      installTime: new Date(
                        getSafe(modAttributes, ["installTime"], 0),
                      ),
                      variant: truthy(variant) ? variant : "Not set",
                    },
                  },
                ),
              };
            }),
            parameters: {
              modName: modName(mods[0], { version: false }),
            },
          },
          [{ label: "Cancel" }, { label: "Continue" }],
        );

      let choices: Bluebird<{
        action: string;
        variant?: string;
        remember: boolean;
      }>;

      const checkRoVRemember: ICheckbox[] = [];
      if (context !== undefined) {
        if (context.get("canceled", false)) {
          return reject(new UserCanceled());
        }

        const action = context.get("replace-or-variant");
        const itemsCompleted = context.get("items-completed", 0);
        const itemsLeft = context.itemCount - itemsCompleted;
        if (itemsLeft > 1) {
          if (action === undefined) {
            checkRoVRemember.push({
              id: "remember",
              value: false,
              text: api.translate(
                "Do this for all remaining reinstalls ({{count}} more)",
                {
                  count: itemsLeft - 1,
                },
              ),
            });
          }
        }

        if (action !== undefined) {
          let variant: string = context.get("variant-name");
          if (action === "variant" && variant === undefined) {
            choices = queryVariantNameDialog(
              context.get("replace-or-variant") !== undefined,
            ).then((variantName) => ({
              action,
              variant: variantName,
              remember: true,
            }));
          } else {
            if (variant !== undefined && installOptions.variantNumber > 1) {
              variant += `.${installOptions.variantNumber}`;
            }
            choices = Bluebird.resolve({
              action,
              variant,
              remember: true,
            });
          }
        }
      }

      // When installing as a dependency, check if the existing mod is enabled in a different profile.
      // If so, create a variant so each profile can have its own version of the mod.
      if (!choices && isDependency) {
        const activeSession = getCollectionActiveSession(api.getState());
        const targetProfileId = currentProfile?.id;

        // Check if any existing mod variant is enabled in a profile OTHER than the target profile
        const profiles = Object.values(state.persistent.profiles).filter(
          (prof) => prof.gameId === gameId && prof.id !== targetProfileId,
        );
        const isEnabledInOtherProfile = modIds.some((modId) =>
          profiles.some((prof) =>
            getSafe(prof.modState, [modId, "enabled"], false),
          ),
        );

        if (isEnabledInOtherProfile && activeSession?.collectionId != null) {
          // Create a variant so the other profile keeps its version
          const collectionMod =
            api.getState().persistent.mods?.[gameId]?.[
              activeSession.collectionId
            ];
          const variantNum = installOptions.variantNumber?.toString() ?? "1";
          const maxLength = MAX_VARIANT_NAME - variantNum.length + 1;
          const rawName =
            collectionMod?.attributes?.customFileName?.trim() ?? "";
          const autoVariant =
            rawName.length > maxLength
              ? `${rawName.substring(0, maxLength)}.${variantNum}`
              : `${rawName}.${variantNum}`;
          choices = Bluebird.resolve({
            action: "variant",
            variant: autoVariant,
            remember: false,
          });
        } else {
          // No other profile uses this mod, safe to replace
          choices = Bluebird.resolve({ action: "replace", remember: false });
        }
      } else {
        choices = choices ?? queryDialog();
      }

      choices
        .then(
          (result: { action: string; variant: string; remember: boolean }) => {
            const wasEnabled = (modId: string) => {
              return currentProfile?.gameId === gameId
                ? getSafe(currentProfile.modState, [modId, "enabled"], false)
                : false;
            };

            const replaceMod = (modId: string) => {
              const mod = mods.find((m) => m.id === modId);
              const variant =
                mod !== undefined
                  ? getSafe(mod.attributes, ["variant"], "")
                  : "";
              api.events.emit(
                "remove-mod",
                gameId,
                modId,
                (err) => {
                  if (err !== null) {
                    reject(err);
                  } else {
                    resolve({
                      id: modId,
                      variant,
                      enable: wasEnabled(modId),
                      attributes: _.omit(mod.attributes, [
                        "version",
                        "fileName",
                        "fileVersion",
                      ]),
                      rules: mod.rules,
                      replaceChoice: "replace",
                    });
                  }
                },
                { willBeReplaced: true },
              );
            };

            if (result.action === "variant") {
              if (result.remember === true) {
                context?.set?.("replace-or-variant", "variant");
              }
              if (currentProfile !== undefined) {
                const actions = modIds.map((id) =>
                  setModEnabled(currentProfile.id, id, false),
                );
                batchDispatch(api.store.dispatch, actions);
              }
              // We want the shortest possible modId paired against this archive
              //  before adding the variant name to it.
              const archiveId = mods[0].archiveId;
              const relevantIds = Object.keys(
                state.persistent.mods[gameId],
              ).filter(
                (id) =>
                  state.persistent.mods[gameId][id]?.archiveId === archiveId,
              );
              const modId = relevantIds.reduce(
                (prev, iter) => (iter.length < prev.length ? iter : prev),
                relevantIds[0],
              );
              // We just disabled all variants - if any of the variants was enabled previously
              //  it's safe to assume that the user wants this new variant enabled.
              const enable = modIds.reduce(
                (prev, iter) => (wasEnabled(iter) ? true : prev),
                false,
              );
              resolve({
                id: modId + "+" + result.variant,
                variant: result.variant,
                enable,
                attributes: {},
                rules: [],
                replaceChoice: "variant",
              });
            } else if (result.action === "replace") {
              if (result.remember === true) {
                context?.set?.("replace-or-variant", "replace");
              }
              if (modIds.length > 1) {
                queryVariantReplacement().then((res: IDialogResult) => {
                  if (res.action === "Cancel") {
                    context?.set?.("canceled", true);
                    reject(new UserCanceled());
                  } else {
                    const selected = Object.keys(res.input).find(
                      (iter) => res.input[iter],
                    );
                    replaceMod(selected);
                  }
                });
              } else {
                replaceMod(modIds[0]);
              }
            } else {
              if (result.action === "Cancel") {
                log("error", 'invalid action in "queryUserReplace"', {
                  action: result.action,
                });
              }
              context?.set?.("canceled", true);
              reject(new UserCanceled());
            }
          },
        )
        .then((result) => {
          if (context !== undefined) {
            context.set(
              "items-completed",
              context.get("items-completed", 0) + 1,
            );
          }
          return result;
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  private getInstaller(
    fileList: string[],
    gameId: string,
    archivePath: string,
    offsetIn?: number,
    details?: ITestSupportedDetails,
  ): Bluebird<ISupportedInstaller> {
    const offset = offsetIn || 0;
    if (offset >= this.mInstallers.length) {
      return Bluebird.resolve(undefined);
    }
    return Bluebird.resolve(
      this.mInstallers[offset].testSupported(
        fileList,
        gameId,
        archivePath,
        details,
      ),
    ).then((testResult: ISupportedResult) => {
      if (testResult === undefined) {
        log("error", "Buggy installer", this.mInstallers[offset].id);
      }
      return testResult?.supported === true
        ? Bluebird.resolve({
            installer: this.mInstallers[offset],
            requiredFiles: testResult.requiredFiles,
          })
        : this.getInstaller(fileList, gameId, archivePath, offset + 1, details);
    });
  }

  /**
   * determine the mod name (on disk) from the archive path
   * TODO: this currently simply uses the archive name which should be fine
   *   for downloads from nexus but in general we need the path to encode the
   *   mod, the specific "component" and the version. And then we need to avoid
   *   collisions.
   *   Finally, the way I know users they will want to customize this.
   *
   * @param {string} archiveName
   * @param {*} info
   * @returns
   */
  private deriveInstallName(archiveName: string, info: any) {
    return deriveModInstallName(archiveName, info);
  }

  private downloadURL(
    api: IExtensionApi,
    lookupResult: IModInfoEx,
    wasCanceled: () => boolean,
    referenceTag?: string,
    campaign?: string,
    fileName?: string,
  ): Bluebird<string> {
    const call = (
      input: string | (() => Bluebird<string>),
    ): Bluebird<string> =>
      input !== undefined && typeof input === "function"
        ? input()
        : Bluebird.resolve(input as string);

    let resolvedSource: string;
    let resolvedReferer: string;

    return call(lookupResult.sourceURI)
      .then((res) => (resolvedSource = res))
      .then(() =>
        call(lookupResult.referer).then((res) => (resolvedReferer = res)),
      )
      .then(
        () =>
          new Bluebird<string>((resolve, reject) => {
            if (wasCanceled()) {
              return reject(new UserCanceled(false));
            } else if (!truthy(resolvedSource)) {
              return reject(new UserCanceled(true));
            }
            const parsedUrl = new URL(resolvedSource);
            if (campaign !== undefined && parsedUrl.protocol === "nxm:") {
              parsedUrl.searchParams.set("campaign", campaign);
            }

            if (
              !api.events.emit(
                "start-download",
                [parsedUrl],
                {
                  game: convertGameIdReverse(
                    knownGames(api.store.getState()),
                    lookupResult.domainName,
                  ),
                  source: lookupResult.source,
                  name: lookupResult.logicalFileName,
                  referer: resolvedReferer,
                  referenceTag,
                  meta: lookupResult,
                },
                fileName,
                async (error, id) => {
                  if (error === null) {
                    return resolve(id);
                  } else if (error instanceof AlreadyDownloaded) {
                    return resolve(error.downloadId);
                  } else if (error instanceof DownloadIsHTML) {
                    // If this is a google drive link and the file exceeds the
                    //  virus testing limit, Google will return an HTML page asking
                    //  the user for consent to download the file. Lets try this using
                    //  the browser extension.
                    const instructions =
                      `You are trying to download "${lookupResult.fileName}" from "${resolvedSource}".\n` +
                      "Depending on the portal, you may be re-directed several times.";
                    const result: string[] = await api.emitAndAwait(
                      "browse-for-download",
                      resolvedSource,
                      instructions,
                    );
                    if (result.length > 0) {
                      const newLookupRes = {
                        ...lookupResult,
                        sourceURI: result[0],
                      };
                      const id = await this.downloadURL(
                        api,
                        newLookupRes,
                        wasCanceled,
                        referenceTag,
                        campaign,
                        fileName,
                      );
                      return resolve(id);
                    } else {
                      return reject(new UserCanceled());
                    }
                  } else {
                    return reject(error);
                  }
                },
                "never",
                { allowInstall: false, allowOpenHTML: false },
              )
            ) {
              return reject(new Error("download manager not installed?"));
            }
          }),
      );
  }

  private downloadMatching(
    api: IExtensionApi,
    lookupResult: IModInfoEx,
    pattern: string,
    referenceTag: string,
    wasCanceled: () => boolean,
    campaign: string,
    fileName?: string,
  ): Bluebird<string> {
    const modId: string = getSafe(
      lookupResult,
      ["details", "modId"],
      undefined,
    );
    const fileId: string = getSafe(
      lookupResult,
      ["details", "fileId"],
      undefined,
    );
    if (modId === undefined && fileId === undefined) {
      return this.downloadURL(
        api,
        lookupResult,
        wasCanceled,
        referenceTag,
        fileName,
      );
    }

    const gameId = convertGameIdReverse(
      knownGames(api.getState()),
      lookupResult.domainName || lookupResult.gameId,
    );

    return api
      .emitAndAwait(
        "start-download-update",
        lookupResult.source,
        gameId,
        modId,
        fileId,
        pattern,
        campaign,
        referenceTag,
      )
      .then((results: Array<{ error: Error; dlId: string }>) => {
        if (results === undefined || results.length === 0) {
          return Bluebird.reject(
            new NotFound(`source not supported "${lookupResult.source}"`),
          );
        } else {
          if (!truthy(results[0])) {
            return Bluebird.reject(
              new ProcessCanceled("Download failed", { alreadyReported: true }),
            );
          } else {
            const successResult = results.find((iter) => iter.error === null);
            if (successResult === undefined) {
              return Bluebird.reject(results[0].error);
            } else {
              api.store.dispatch(
                setDownloadModInfo(
                  results[0].dlId,
                  "referenceTag",
                  referenceTag,
                ),
              );
              return Bluebird.resolve(results[0].dlId);
            }
          }
        }
      });
  }

  private downloadDependencyAsync(
    requirement: IModReference,
    api: IExtensionApi,
    lookupResult: IModInfoEx,
    wasCanceled: () => boolean,
    fileName: string,
  ): Bluebird<string> {
    const referenceTag = requirement["tag"];
    const { campaign } = requirement["repo"] ?? {};

    if (
      requirement.versionMatch !== undefined &&
      (!requirement.versionMatch.endsWith("+prefer") ||
        lookupResult.archived) &&
      isFuzzyVersion(requirement.versionMatch)
    ) {
      // seems to be a fuzzy matcher so we may have to look for an update
      return this.downloadMatching(
        api,
        lookupResult,
        requirement.versionMatch,
        referenceTag,
        wasCanceled,
        campaign,
        fileName,
      )
        .catch((err) => {
          if (err instanceof HTTPError) {
            // assuming the api failed because the mod had been archive, can still download
            // the exact file specified by the curator
            return undefined;
          } else {
            return Bluebird.reject(err);
          }
        })
        .then((res) =>
          res === undefined
            ? this.downloadURL(
                api,
                lookupResult,
                wasCanceled,
                referenceTag,
                campaign,
                fileName,
              )
            : res,
        );
    } else {
      return this.downloadURL(
        api,
        lookupResult,
        wasCanceled,
        referenceTag,
        campaign,
        fileName,
      ).catch((err) => {
        if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
          return Bluebird.reject(err);
        }
        // with +prefer versions, if the exact version isn't available, an update is acceptable
        if (requirement.versionMatch?.endsWith?.("+prefer")) {
          return this.downloadMatching(
            api,
            lookupResult,
            requirement.versionMatch,
            referenceTag,
            wasCanceled,
            campaign,
            fileName,
          );
        } else {
          return Bluebird.reject(err);
        }
      });
    }
  }

  private applyExtraFromRule(
    api: IExtensionApi,
    gameId: string,
    modId: string,
    extra?: { [key: string]: any },
  ) {
    if (extra === undefined) {
      return;
    }

    if (extra.type !== undefined) {
      api.store.dispatch(setModType(gameId, modId, extra.type));
    }

    const attributes = {};

    if (extra.name !== undefined) {
      attributes["customFileName"] = extra.name;
    }

    if (extra.url !== undefined) {
      attributes["source"] = "website";
      attributes["url"] = extra.url;
    }

    if (extra.category !== undefined) {
      const categoryId = resolveCategoryId(extra.category, api.getState());
      if (categoryId !== undefined) {
        attributes["category"] = categoryId;
      }
    }

    if (extra.author !== undefined) {
      attributes["author"] = extra.author;
    }

    if (extra.version !== undefined) {
      attributes["version"] = extra.version;
    }

    if (extra.patches !== undefined) {
      attributes["patches"] = extra.patches;
    }

    if (extra.fileList !== undefined) {
      attributes["fileList"] = extra.fileList;
    }

    if (extra.installerChoices !== undefined) {
      attributes["installerChoices"] = extra.installerChoices;
    }

    api.store.dispatch(setModAttributes(gameId, modId, attributes));
  }

  private dropUnfulfilled(
    api: IExtensionApi,
    dep: IDependency,
    gameId: string,
    sourceModId: string,
    recommended: boolean,
  ) {
    log("info", "ignoring unfulfillable rule", { gameId, sourceModId, dep });
    if (recommended) {
      // not ignoring recommended dependencies because what would be the point?
      return;
    }
    const refName = renderModReference(dep.reference, undefined);
    api.store.dispatch(
      addModRule(gameId, sourceModId, {
        type: recommended ? "recommends" : "requires",
        ..._.pick(dep, ["reference", "extra", "fileList", "installerChoices"]),
        ignored: true,
      }),
    );
    api.sendNotification({
      type: "warning",
      title: "Unfulfillable rule dropped",
      group: "unfulfillable-rule-dropped",
      message: refName,
      actions: [
        {
          title: "More",
          action: () => {
            const sourceMod =
              api.getState().persistent.mods[gameId]?.[sourceModId];
            api.showDialog(
              "info",
              "Unfulfillable rule disabled",
              {
                text:
                  'The mod "{{modName}}" has a dependency on "{{refName}}" which ' +
                  "Vortex is not able to fulfill automatically.\n\n" +
                  "Very likely Vortex would also not recognize the rule as " +
                  "fulfilled even if you did install it manually. Therefore the rule " +
                  "has been disabled.\n\n" +
                  "Please consult the mod instructions on if and how to solve this dependency.",
                parameters: {
                  modName: modName(sourceMod),
                  refName,
                },
              },
              [{ label: "Close" }],
            );
          },
        },
      ],
    });
  }

  private doInstallDependenciesPhase(
    api: IExtensionApi,
    dependencies: IDependency[],
    gameId: string,
    sourceModId: string,
    recommended: boolean,
    doDownload: (
      dep: IDependency,
    ) => Bluebird<{ updatedDep: IDependency; downloadId: string }>,
    abort: AbortController,
    silent: boolean,
  ): Bluebird<IDependency[]> {
    const res: Bluebird<IDependency[]> = Bluebird.map(
      dependencies,
      async (dep: IDependency) => {
        if (abort.signal.aborted) {
          return Bluebird.reject(new UserCanceled());
        }
        log("debug", "installing as dependency", {
          ref: dep.reference.logicalFileName,
          downloadRequired: dep.download === undefined,
        });

        const alreadyInstalled = dep.mod !== undefined;

        return (
          doDownload(dep)
            .then(({ updatedDep, downloadId }) => {
              const modId = updatedDep.mod?.id;
              if (modId == null) {
                // installation has been queued within doDownload, return
                //  the updated dependency so that the downloads can keep going.
                return Bluebird.resolve(updatedDep);
              }
              log("info", "installed as dependency", { modId });
              if (!alreadyInstalled) {
                api.store.dispatch(
                  setModAttribute(gameId, modId, "installedAsDependency", true),
                );
              }

              const state = api.getState();
              const batchedActions = [];
              // Enable the mod only for the target profile to avoid affecting other profiles
              const batchContext = getBatchContext(
                [
                  "install-dependencies",
                  "install-collections",
                  "install-recommendations",
                ],
                "",
              );
              const targetProfileId =
                batchContext?.get<string>("profileId") ??
                activeProfile(state)?.id;
              const targetProfile = targetProfileId
                ? profileById(state, targetProfileId)
                : undefined;

              if (targetProfile) {
                // Only modify the target profile - disable other variants and enable this one
                const otherModIds = this.checkModVariantsExist(
                  api,
                  gameId,
                  downloadId,
                );
                for (const otherModId of otherModIds) {
                  batchedActions.push(
                    setModEnabled(targetProfile.id, otherModId, false),
                  );
                }
                batchedActions.push(
                  setModEnabled(targetProfile.id, modId, true),
                );
              } else {
                // Fallback: enable in profiles where source mod is enabled (original behavior)
                const profiles = Object.values(
                  api.getState().persistent.profiles,
                ).filter(
                  (prof) =>
                    prof.gameId === gameId &&
                    prof.modState?.[sourceModId]?.enabled,
                );
                profiles.forEach((prof) => {
                  const otherModIds = this.checkModVariantsExist(
                    api,
                    gameId,
                    downloadId,
                  );
                  for (const otherModId of otherModIds) {
                    batchedActions.push(
                      setModEnabled(prof.id, otherModId, false),
                    );
                  }
                  batchedActions.push(setModEnabled(prof.id, modId, true));
                });
              }

              batchDispatch(api.store, batchedActions);

              this.applyExtraFromRule(api, gameId, modId, {
                ...dep.extra,
                fileList: dep.fileList ?? dep.extra?.fileList,
                installerChoices: dep.installerChoices,
                patches: dep.patches ?? dep.extra?.patches,
              });

              const mods = api.store.getState().persistent.mods[gameId];
              return { ...dep, mod: mods[modId] };
            })
            .catch((err) => {
              if (dep.extra?.onlyIfFulfillable) {
                this.dropUnfulfilled(
                  api,
                  dep,
                  gameId,
                  sourceModId,
                  recommended,
                );
                return Bluebird.resolve(undefined);
              } else {
                return Bluebird.reject(err);
              }
            })
            // don't cancel the whole process if one dependency fails to install
            .catch(ProcessCanceled, (err) => {
              if (
                err.extraInfo !== undefined &&
                err.extraInfo.alreadyReported
              ) {
                return Bluebird.resolve(undefined);
              }
              const refName = renderModReference(dep.reference, undefined);
              const message =
                err.message +
                "\nA common cause for issues here is that the file may no longer " +
                "be available. You may want to install a current version of the specified mod " +
                "and update or remove the dependency for the old one.";
              this.showDependencyError(
                api,
                sourceModId,
                "Failed to install dependency",
                message,
                refName,
                {
                  allowReport: false,
                  silent,
                },
              );
              return Bluebird.resolve(undefined);
            })
            .catch(DownloadIsHTML, () => {
              const refName = renderModReference(dep.reference, undefined);
              const message =
                "The direct download URL for this file is not valid or didn't lead to a file. " +
                "This may be a setup error in the dependency or the file has been moved.";
              this.showDependencyError(
                api,
                sourceModId,
                "Failed to install dependency",
                message,
                refName,
                {
                  allowReport: false,
                  silent,
                },
              );
              return Bluebird.resolve(undefined);
            })
            .catch(NotFound, (err) => {
              const refName = renderModReference(dep.reference, undefined);
              this.showDependencyError(
                api,
                sourceModId,
                "Failed to install dependency",
                err,
                refName,
                {
                  allowReport: false,
                  silent,
                },
              );
              return Bluebird.resolve(undefined);
            })
            .catch((err) => {
              const refName =
                dep.reference !== undefined
                  ? renderModReference(dep.reference, undefined)
                  : "undefined";
              if (err instanceof UserCanceled) {
                if (err.skipped) {
                  return Bluebird.resolve(undefined);
                } else {
                  abort.abort();
                  return Bluebird.reject(err);
                }
              } else if (err.code === "Z_BUF_ERROR") {
                this.showDependencyError(
                  api,
                  sourceModId,
                  "Download failed",
                  "The download ended prematurely or was corrupted. You'll have to restart it.",
                  refName,
                  {
                    allowReport: false,
                    silent,
                  },
                );
              } else if ([403, 404, 410].includes(err["statusCode"])) {
                const message = `${err["message"]}\n\nThis error is usually caused by an invalid request, maybe you followed a link that has expired or you lack permission to access it.`;
                this.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  message,
                  refName,
                  {
                    allowReport: false,
                    silent,
                  },
                );

                return Bluebird.resolve();
              } else if (err.code === "ERR_INVALID_PROTOCOL") {
                const msg = err.message.replace(/ Expected .*/, "");
                const message =
                  "The URL protocol used in the dependency is not supported, " +
                  "you may be missing an extension required to handle it:\n" +
                  msg;
                this.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  message,
                  refName,
                  {
                    allowReport: false,
                    silent,
                  },
                );
              } else if (err.name === "HTTPError") {
                err["attachLogOnReport"] = true;
                this.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  err,
                  refName,
                  {
                    allowReport: true,
                    silent,
                  },
                );
              } else {
                const pretty = prettifyNodeErrorMessage(err);
                this.showDependencyError(
                  api,
                  sourceModId,
                  "Failed to install dependency",
                  err,
                  refName,
                  {
                    allowReport: pretty.allowReport,
                    silent,
                  },
                );
              }
              return Bluebird.resolve(undefined);
            })
            .then((updatedDependency: IDependency) => {
              if (updatedDependency === undefined) {
                return Bluebird.resolve(undefined);
              }
              log("debug", "done installing dependency", {
                ref: dep.reference?.logicalFileName,
              });
              return Bluebird.resolve(updatedDependency);
            })
        );
      },
      { concurrency: 10 },
    )
      .finally(() => {
        // Process any pending installations that were queued during dependency installation
        const phaseState = this.mInstallPhaseState.get(sourceModId);
        if (phaseState && phaseState.allowedPhase !== undefined) {
          this.startPendingForPhase(sourceModId, phaseState.allowedPhase);

          // Scan for any finished downloads that haven't been queued yet
          // This handles downloads that were imported/finished before the collection started installing
          log("debug", "Scanning for unqueued finished downloads", {
            sourceModId,
          });
          const state = api.getState();
          const downloads = state.persistent.downloads.files;
          let foundCount = 0;
          dependencies.forEach((dep: IDependency) => {
            const downloadId = getReadyDownloadId(
              downloads,
              dep.reference,
              (id) => this.hasActiveOrPendingInstallation(sourceModId, id),
            );

            if (downloadId) {
              const rulePhase = dep.extra?.phase ?? 0;
              // Only process downloads for the current allowed phase or earlier
              if (rulePhase <= phaseState.allowedPhase) {
                this.handleDownloadFinished(api, downloadId, sourceModId);
                foundCount++;
              }
            }
          });
          log("debug", "Finished scanning for unqueued downloads", {
            sourceModId,
            foundCount,
          });

          this.maybeAdvancePhase(sourceModId, api);
        }

        log("info", "done installing dependencies");
      })
      .catch(ProcessCanceled, (err) => {
        // This indicates an error in the dependency rules so it's
        // adequate to show an error but not as a bug in Vortex

        // Clean up phase state and dependency tracking when process is canceled
        delete this.mDependencyInstalls[sourceModId];
        this.cleanupPendingInstalls(sourceModId, true);

        api.showErrorNotification(
          "Failed to install dependencies",
          err.message,
          { allowReport: false },
        );
        return Bluebird.resolve([]);
      })
      .catch(UserCanceled, () => {
        log("info", "canceled out of dependency install");
        // Cancel all remaining operations when user cancels
        abort.abort();

        // Clean up phase state and dependency tracking when canceled
        delete this.mDependencyInstalls[sourceModId];
        this.cleanupPendingInstalls(sourceModId, true);

        api.sendNotification({
          id: "dependency-installation-canceled",
          type: "info",
          message: "Installation of dependencies canceled",
        });
        return Bluebird.resolve([]);
      })
      .catch((err) => {
        api.showErrorNotification("Failed to install dependencies", err);
        return Bluebird.resolve([]);
      })
      .filter((dep) => dep !== undefined);

    return Bluebird.resolve(res);
  }

  private doInstallDependencies(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dependencies: IDependency[],
    recommended: boolean,
    silent: boolean,
  ): Bluebird<IDependency[]> {
    const state: IState = api.getState();
    let downloads: { [id: string]: IDownload } =
      state.persistent.downloads.files;

    const sourceMod = state.persistent.mods[gameId][sourceModId];
    const stagingPath = installPathForGame(state, gameId);

    if (sourceMod?.installationPath === undefined) {
      return Bluebird.resolve([]);
    }

    let queuedDownloads: IModReference[] = [];

    const clearQueued = () => {
      const downloadsNow = api.getState().persistent.downloads.files;
      // cancel in reverse order so that canceling a running download doesn't
      // trigger a previously pending download to start just to then be canceled too.
      // Obviously this is probably not a robust way of achieving that but what is?
      queuedDownloads.reverse().forEach((ref) => {
        const dlId = findDownloadByRef(ref, downloadsNow);
        log("info", "cancel dependency dl", {
          name: renderModReference(ref),
          dlId,
        });
        if (dlId !== undefined) {
          api.events.emit("pause-download", dlId);
        } else {
          api.events.emit("intercept-download", ref.tag);
        }
      });
      queuedDownloads = [];

      delete this.mDependencyInstalls[sourceModId];
      this.cleanupPendingInstalls(sourceModId, true);
    };

    const queueDownload = (dep: IDependency): Bluebird<string> => {
      return this.mDependencyDownloadsLimit.do<string>(() => {
        if (dep.reference.tag !== undefined) {
          queuedDownloads.push(dep.reference);
        }
        return abort.signal.aborted
          ? Bluebird.reject(new UserCanceled(false))
          : this.downloadDependencyAsync(
              dep.reference,
              api,
              dep.lookupResults[0].value,
              () => abort.signal.aborted,
              dep.extra?.fileName,
            )
              .then((dlId) => {
                const idx = queuedDownloads.indexOf(dep.reference);
                queuedDownloads.splice(idx, 1);
                return dlId;
              })
              .catch((err) => {
                const idx = queuedDownloads.indexOf(dep.reference);
                queuedDownloads.splice(idx, 1);

                // Check if this is a network error that might have caused the download to be paused
                const isNetworkError =
                  err.message?.includes("socket hang up") ||
                  err.message?.includes("ECONNRESET") ||
                  err.message?.includes("ETIMEDOUT") ||
                  err.code === "ECONNRESET" ||
                  err.code === "ETIMEDOUT";

                // Check if this is a "File already downloaded" error (for cases where we get a generic error message)
                const isAlreadyDownloaded =
                  err instanceof AlreadyDownloaded ||
                  err.message?.includes("File already downloaded") ||
                  err.message?.includes("already downloaded");

                if (isAlreadyDownloaded) {
                  if (err.downloadId !== undefined) {
                    log(
                      "info",
                      "File already downloaded, using existing download ID",
                      { downloadId: err.downloadId },
                    );
                    return Bluebird.resolve(err.downloadId);
                  }
                  // If file is already downloaded, check if we can find the download
                  // Try to find the download by filename
                  const currentDownloads =
                    api.getState().persistent.downloads.files;
                  const downloadId = Object.keys(currentDownloads).find(
                    (dlId) =>
                      currentDownloads[dlId].localPath === err.fileName ||
                      currentDownloads[dlId].modInfo?.referenceTag ===
                        dep.reference?.tag,
                  );

                  if (downloadId) {
                    log(
                      "info",
                      "Download already completed, using existing download",
                      { downloadId },
                    );
                    return Bluebird.resolve(downloadId);
                  } else {
                    // The download file exists but we can't find its record - refresh downloads and try again
                    return new Bluebird((resolve) => {
                      api.events.emit("refresh-downloads", gameId, () => {
                        const currentDownloads =
                          api.getState().persistent.downloads.files;
                        const downloadId = Object.keys(currentDownloads).find(
                          (dlId) =>
                            currentDownloads[dlId].localPath === err.fileName,
                        );
                        return downloadId ? resolve(downloadId) : resolve(null);
                      });
                    });
                  }
                }

                if (isNetworkError) {
                  // For network errors, check if the download ended up in paused state
                  // and if so, try to resume it through the concurrent queue
                  setTimeout(() => {
                    const currentDownloads =
                      api.getState().persistent.downloads.files;
                    const downloadId = Object.keys(currentDownloads).find(
                      (dlId) =>
                        currentDownloads[dlId].modInfo?.referenceTag ===
                        dep.reference?.tag,
                    );

                    if (
                      downloadId &&
                      currentDownloads[downloadId].state === "paused"
                    ) {
                      log(
                        "info",
                        "Network error resulted in paused download, will attempt resume",
                        {
                          downloadId,
                          error: err.message,
                        },
                      );
                      // The download will be caught by the paused download check in doDownload
                      return;
                    }
                  }, 1000);
                }

                return Bluebird.reject(err);
              });
      });
    };

    const resumeDownload = (dep: IDependency): Bluebird<string> => {
      // This function handles resuming downloads that were paused due to network issues or user action
      return this.mDependencyDownloadsLimit.do<string>(() =>
        abort.signal.aborted
          ? Bluebird.reject(new UserCanceled(false))
          : new Bluebird((resolve, reject) => {
              // First check current download state to avoid unnecessary resume attempts
              const currentDownloads =
                api.getState().persistent.downloads.files;
              let resolvedId: string = dep.download;
              let currentDownload = currentDownloads[resolvedId];

              if (!currentDownload) {
                // Try to resolve the download by referenceTag if possible
                const tag = dep.reference?.tag;
                if (truthy(tag)) {
                  const foundId = Object.keys(currentDownloads).find(
                    (dlId) =>
                      currentDownloads[dlId]?.modInfo?.referenceTag === tag,
                  );
                  if (foundId) {
                    log(
                      "info",
                      "Resolved missing download id from referenceTag",
                      { from: dep.download, to: foundId, tag },
                    );
                    resolvedId = foundId;
                    currentDownload = currentDownloads[resolvedId];
                  }
                }
              }

              if (!currentDownload) {
                const readableRef = renderModReference(dep.reference);
                log("warn", "Download not found when trying to resume", {
                  intendedId: dep.download,
                  ref: readableRef,
                });
                return reject(new NotFound(`download for ${readableRef}`));
              }

              if (currentDownload.state === "finished") {
                log("info", "Download already finished, no need to resume", {
                  downloadId: resolvedId,
                });
                return resolve(resolvedId);
              }

              if (currentDownload.state !== "paused") {
                log("info", "Download not in paused state", {
                  downloadId: resolvedId,
                  state: currentDownload.state,
                });
                return resolve(resolvedId);
              }

              log("info", "Resuming paused download", {
                downloadId: resolvedId,
                tag: dep.reference?.tag,
              });

              api.events.emit(
                "resume-download",
                resolvedId,
                (err) => {
                  if (err !== null) {
                    // Handle "File already downloaded" error gracefully
                    if (
                      err.message?.includes("File already downloaded") ||
                      err.message?.includes("already downloaded")
                    ) {
                      log(
                        "info",
                        "Download already completed during resume attempt",
                        { downloadId: resolvedId },
                      );
                      return resolve(resolvedId);
                    }
                    reject(err);
                  } else {
                    resolve(resolvedId);
                  }
                },
                { allowInstall: false },
              );
            }),
      );
    };

    const installDownload = (
      dep: IDependency,
      downloadId: string,
    ): Bluebird<string> => {
      return new Bluebird<string>((resolve, reject) => {
        return this.mDependencyInstallsLimit.do(async () => {
          return abort.signal.aborted
            ? reject(new UserCanceled(false))
            : this.withInstructions(
                api,
                modName(sourceMod),
                renderModReference(dep.reference),
                dep.reference?.tag ?? downloadId,
                dep.extra?.["instructions"],
                recommended,
                () =>
                  this.installModAsync(
                    dep.reference,
                    api,
                    downloadId,
                    { choices: dep.installerChoices, patches: dep.patches },
                    dep.fileList,
                    gameId,
                    silent,
                    sourceModId,
                  ),
              )
                .then((res) => resolve(res))
                .catch((err) => {
                  if (err instanceof UserCanceled) {
                    err.skipped = true;
                  }
                  return reject(err);
                });
        });
      });
    };

    const doDownload = (
      dep: IDependency,
    ): Bluebird<{ updatedDep: IDependency; downloadId: string }> => {
      let dlPromise = Bluebird.resolve(dep.download);
      // Alternate between ProcessCanceled and NotFound for failed download URL
      // if (Math.random() < 0.5) {
      //   return Bluebird.reject(new ProcessCanceled('Failed to determine download url'));
      // } else {
      //   return Bluebird.reject(new NotFound('Failed to determine download url'));
      // }
      if (dep.download === undefined || downloads[dep.download] === undefined) {
        if (dep.extra?.localPath !== undefined) {
          // the archive is shipped with the mod that has the dependency
          const downloadPath = downloadPathForGame(state, gameId);
          const fileName = path.basename(dep.extra.localPath);
          let targetPath = path.join(downloadPath, fileName);
          // backwards compatibility: during alpha testing the bundles were 7zipped inside
          // the collection
          if (path.extname(fileName) !== ".7z") {
            targetPath += ".7z";
          }
          dlPromise = fs
            .statAsync(targetPath)
            .then(() =>
              Object.keys(downloads).find(
                (dlId) => downloads[dlId].localPath === fileName,
              ),
            )
            .catch(
              (err) =>
                new Bluebird((resolve, reject) => {
                  api.events.emit(
                    "import-downloads",
                    [
                      path.join(
                        stagingPath,
                        sourceMod.installationPath,
                        dep.extra.localPath,
                      ),
                    ],
                    (dlIds: string[]) => {
                      if (dlIds.length > 0) {
                        api.store.dispatch(
                          setDownloadModInfo(
                            dlIds[0],
                            "referenceTag",
                            dep.reference.tag,
                          ),
                        );
                        resolve(dlIds[0]);
                      } else {
                        resolve();
                      }
                    },
                    true,
                  );
                }),
            );
        } else {
          // Always allow downloads to be queued - installations will be deferred if needed
          dlPromise =
            (dep.lookupResults[0]?.value?.sourceURI ?? "") === ""
              ? Bluebird.reject(
                  new ProcessCanceled("Failed to determine download url"),
                )
              : queueDownload(dep);
        }
      } else if (dep.download === null) {
        dlPromise = Bluebird.reject(
          new ProcessCanceled("Failed to determine download url"),
        );
      } else if (downloads[dep.download]?.state === "paused") {
        // Get fresh state to ensure accurate paused detection
        const freshDownloads = api.getState().persistent.downloads.files;
        if (freshDownloads[dep.download]?.state === "paused") {
          dlPromise = resumeDownload(dep);
        } else {
          dlPromise = Bluebird.resolve(dep.download);
        }
      }
      return dlPromise
        .catch(UserCanceled, (err) => {
          if (err.skipped) {
            this.handleDownloadSkipped(api, sourceModId, dep);
          }
          return Bluebird.reject(err);
        })
        .catch(AlreadyDownloaded, (err) => {
          if (err.downloadId !== undefined) {
            return Bluebird.resolve(err.downloadId);
          } else {
            const downloadId = Object.keys(downloads).find(
              (dlId) => downloads[dlId].localPath === err.fileName,
            );
            if (downloadId !== undefined) {
              return Bluebird.resolve(downloadId);
            }
          }
          return Bluebird.reject(
            new NotFound(`download for ${renderModReference(dep.reference)}`),
          );
        })
        .then((downloadId: string) => {
          // Get fresh state before checking if download is paused
          const freshDownloads = api.getState().persistent.downloads.files;
          if (
            downloadId !== undefined &&
            freshDownloads[downloadId]?.state === "paused"
          ) {
            return resumeDownload(dep);
          } else {
            return Bluebird.resolve(downloadId);
          }
        })
        .then((downloadId: string) => {
          downloads = api.getState().persistent.downloads.files;

          if (downloadId === undefined || downloads[downloadId] === undefined) {
            return Bluebird.reject(
              new NotFound(`download for ${renderModReference(dep.reference)}`),
            );
          }
          if (downloads[downloadId].state !== "finished") {
            // download not actually finished, may be paused
            return Bluebird.reject(new UserCanceled(true));
          }

          if (
            dep.reference.tag !== undefined &&
            downloads[downloadId].modInfo?.referenceTag !== undefined &&
            downloads[downloadId].modInfo?.referenceTag !== dep.reference.tag
          ) {
            // we can't change the tag on the download because that might break
            // dependencies on the other mod
            // instead we update the rule in the collection. This has to happen immediately,
            // otherwise the installation might have weird issues around the mod
            // being installed having a different tag than the rule
            const reference: IModReference = {
              ...dep.reference,
              fileList: dep.fileList,
              patches: dep.patches,
              installerChoices: dep.installerChoices,
              tag: downloads[downloadId].modInfo.referenceTag,
            };
            dep.reference =
              this.updateModRule(
                api,
                gameId,
                sourceModId,
                dep,
                reference,
                recommended,
              )?.reference ?? reference;

            dep.mod = findModByRef(
              dep.reference,
              api.getState().persistent.mods[gameId],
            );
          } else {
            log("info", "downloaded as dependency", {
              dependency: dep.reference.logicalFileName,
              downloadId,
            });
          }

          return dep.mod == null
            ? Bluebird.resolve()
                .then(() => {
                  // Queue installation for already-finished downloads that aren't
                  // installed yet. Without this, mods whose archives already exist
                  // (e.g. from a prior cancelled install) would never be queued
                  // because the did-finish-download event only fires for NEW
                  // downloads. queueInstallation deduplicates internally.
                  const freshDownloads =
                    api.getState().persistent.downloads.files;
                  if (
                    downloadId &&
                    freshDownloads[downloadId]?.state === "finished" &&
                    freshDownloads[downloadId]?.size > 0
                  ) {
                    this.queueInstallation(
                      api,
                      dep,
                      downloadId,
                      gameId,
                      sourceModId,
                      recommended,
                      dep.phase ?? 0,
                    );
                  }
                  return Bluebird.resolve({ updatedDep: dep, downloadId });
                })
                .catch((err) => {
                  if (dep["reresolveDownloadHint"] === undefined) {
                    return Bluebird.reject(err);
                  }
                  const newState = api.getState();
                  const download =
                    newState.persistent.downloads.files[downloadId];

                  let removeProm = Bluebird.resolve();
                  if (download !== undefined) {
                    // Convert download game ID from Nexus domain ID to internal ID for path resolution
                    const games = knownGames(newState);
                    const convertedGameId = convertGameIdReverse(
                      games,
                      download.game[0],
                    );
                    const pathGameId = convertedGameId || download.game[0];

                    const fullPath: string = path.join(
                      downloadPathForGame(newState, pathGameId),
                      download.localPath,
                    );
                    removeProm = fs.removeAsync(fullPath);
                  }

                  return removeProm
                    .then(() => dep["reresolveDownloadHint"]())
                    .then(() => doDownload(dep));
                })
            : Bluebird.resolve({ updatedDep: dep, downloadId });
        });
    };

    const phases: { [phase: number]: IDependency[] } = {};

    dependencies.forEach((dep) =>
      setdefault(phases, dep.phase ?? 0, []).push(dep),
    );

    // Initialize phase state immediately after determining what phases we have
    if (dependencies.length > 0) {
      this.ensurePhaseState(sourceModId);
      const phaseState = this.mInstallPhaseState.get(sourceModId);

      const phaseNumbers = Object.keys(phases)
        .map((p) => parseInt(p, 10))
        .sort((a, b) => a - b);
      const lowestPhase = phaseNumbers[0];

      // Check collection session to determine actual current phase
      const activeCollectionSession = getCollectionSessionById(
        api.getState(),
        sourceModId,
      );

      if (activeCollectionSession) {
        // Determine the highest completed phase from the collection session
        const mods = activeCollectionSession.mods || {};
        const allMods = Object.values(mods);

        // Find all phases that exist in the collection
        const allPhases = new Set<number>();
        allMods.forEach((mod: any) => {
          allPhases.add(mod.phase ?? 0);
        });

        // Find the highest phase where all required mods are complete
        let highestCompletedPhase = -1;
        Array.from(allPhases)
          .sort((a, b) => a - b)
          .forEach((phase) => {
            const isPhaseComplete = isCollectionPhaseComplete(
              api.getState(),
              phase,
            );

            if (isPhaseComplete) {
              highestCompletedPhase = phase;
            }
          });

        // Set allowed phase to the next phase after the highest completed one
        // or to the lowest phase in our current dependencies if higher
        const nextPhaseAfterCompleted = highestCompletedPhase + 1;
        const effectiveStartPhase = Math.max(
          lowestPhase,
          nextPhaseAfterCompleted,
        );

        if (
          phaseState.allowedPhase === undefined ||
          phaseState.allowedPhase < effectiveStartPhase
        ) {
          phaseState.allowedPhase = effectiveStartPhase;
          // When setting allowed phase, mark all previous phases as downloads finished
          for (let p = 0; p < effectiveStartPhase; p++) {
            phaseState.downloadsFinished.add(p);
          }
        }
      } else if (phaseState.allowedPhase === undefined) {
        // No active session, use the lowest phase from dependencies
        phaseState.allowedPhase = lowestPhase;
        // When setting initial allowed phase, mark all previous phases as downloads finished
        for (let p = 0; p < lowestPhase; p++) {
          phaseState.downloadsFinished.add(p);
        }
        log("info", "Set initial allowed phase", {
          sourceModId,
          allowedPhase: lowestPhase,
        });
      }

      // Mark all phases as having downloads (they will be processed)
      phaseNumbers.forEach((phase) => {
        phaseState.downloadsFinished.add(phase);
      });
    }

    const abort = new AbortController();

    abort.signal.onabort = () => clearQueued();

    const phaseList = Object.values(phases);

    const res: Bluebird<IDependency[]> = Bluebird.reduce(
      phaseList,
      (prev: IDependency[], depList: IDependency[], idx: number) => {
        if (depList.length === 0) {
          return prev;
        }
        return this.doInstallDependenciesPhase(
          api,
          depList,
          gameId,
          sourceModId,
          recommended,
          doDownload,
          abort,
          silent,
        )
          .then((updated: IDependency[]) => {
            // Mark this phase's downloads as finished to allow its installers to run,
            // but do not wait for installations to complete before proceeding to next phase.
            const phaseNum = depList[0]?.phase ?? 0;
            this.markPhaseDownloadsFinished(sourceModId, phaseNum, api);
            return updated;
          })
          .then((updated: IDependency[]) => {
            // Schedule a deploy for this phase once its installers settle; don't block download progression
            const phaseNum = depList[0]?.phase ?? 0;
            const phaseState = this.mInstallPhaseState.get(sourceModId);
            // // Only schedule deploy polling for the current allowed phase to maintain sequential processing
            // if (phaseState && (phaseState.allowedPhase !== undefined) && (phaseNum === phaseState.allowedPhase)) {
            //   this.scheduleDeployOnPhaseSettled(api, sourceModId, phaseNum);
            // }
            return updated;
          })
          .then((updated: IDependency[]) => [].concat(prev, updated));
      },
      [],
    );

    this.mDependencyInstalls[sourceModId] = () => {
      abort.abort();
    };

    return Bluebird.resolve(res)
      .then((deps: IDependency[]) => {
        return this.pollAllPhasesComplete(api, sourceModId).then(() => deps);
      })
      .finally(() => {
        this.mInstallPhaseState.delete(sourceModId);
      });
  }

  private updateModRule(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dep: IDependency,
    reference: IModReference,
    recommended: boolean,
  ): IModRule | undefined {
    const state: IState = api.store.getState();
    const rules: IModRule[] = getSafe(
      state.persistent.mods,
      [gameId, sourceModId, "rules"],
      [],
    );
    const oldRule = rules.find((iter) =>
      referenceEqual(iter.reference, dep.reference),
    );

    const type = recommended ? "recommends" : "requires";

    if (oldRule === undefined) {
      return undefined;
    }

    if (oldRule.type === type && referenceEqual(oldRule.reference, reference)) {
      return oldRule;
    }

    const updatedRule: IModRule = { ...oldRule, type, reference };

    api.store.dispatch(removeModRule(gameId, sourceModId, oldRule));
    api.store.dispatch(addModRule(gameId, sourceModId, updatedRule));
    return updatedRule;
  }

  private updateRules(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dependencies: IDependency[],
    recommended: boolean,
  ): Bluebird<void> {
    dependencies.forEach((dep) => {
      const updatedRef: IModReference = { ...dep.reference };
      updatedRef.idHint = dep.mod?.id;
      updatedRef.installerChoices = dep.installerChoices;
      updatedRef.patches = dep.patches;
      updatedRef.fileList = dep.fileList;
      this.updateModRule(
        api,
        gameId,
        sourceModId,
        dep,
        updatedRef,
        recommended,
      );
    });
    return Bluebird.resolve();
  }

  private doInstallDependencyList(
    api: IExtensionApi,
    profile: IProfile,
    gameId: string,
    modId: string,
    name: string,
    dependencies: IDependency[],
    silent: boolean,
  ) {
    if (dependencies.length === 0) {
      return Bluebird.resolve();
    }

    interface IDependencySplit {
      success: IDependency[];
      existing: IDependency[];
      error: IDependencyError[];
    }

    // get updated mod state
    const modState =
      profile !== undefined
        ? (api.getState().persistent.profiles[profile.id]?.modState ?? {})
        : {};

    const mods = api.getState().persistent.mods?.[gameId] ?? {};

    const { success, existing, error } = dependencies.reduce(
      (prev: IDependencySplit, dep: Dependency) => {
        if (dep["error"] !== undefined) {
          prev.error.push(dep as IDependencyError);
        } else {
          const { mod, reference } = dep as IDependency;
          const modReference: IModReference = {
            ...(dep as IDependency),
            ...reference,
          };
          if (
            mod === undefined ||
            !(modState[mod.id]?.enabled ?? false) ||
            (!!mods[mod.id] &&
              testModReference(mods[mod.id], modReference) !== true)
          ) {
            prev.success.push(dep as IDependency);
          } else {
            prev.existing.push(dep as IDependency);
          }
        }
        return prev;
      },
      { success: [], existing: [], error: [] },
    );

    log("debug", "determined unfulfilled dependencies", {
      count: success.length,
      errors: error.length,
    });

    if (silent && error.length === 0) {
      return this.doInstallDependencies(
        api,
        gameId,
        modId,
        success,
        false,
        silent,
      ).then((updated) =>
        this.updateRules(
          api,
          gameId,
          modId,
          [].concat(existing, updated),
          false,
        ),
      );
    }

    if (success.length === 0) {
      return Bluebird.resolve();
    }

    const context = getBatchContext("install-dependencies", "", true);

    return this.showMemoDialog(api, context, name, success, error).then(
      (result) => {
        if (result.action === "Install") {
          return this.doInstallDependencies(
            api,
            gameId,
            modId,
            success,
            false,
            silent,
          ).then((updated) =>
            this.updateRules(
              api,
              gameId,
              modId,
              [].concat(existing, updated),
              false,
            ),
          );
        } else {
          return Bluebird.resolve();
        }
      },
    );
  }

  private showMemoDialog(
    api: IExtensionApi,
    context: IBatchContext,
    name: string,
    success: IDependency[],
    error: IDependencyError[],
  ): Bluebird<IDialogResult> {
    const remember = context.get<boolean>("remember", null);

    if (truthy(remember)) {
      return Bluebird.resolve<IDialogResult>({
        action: remember ? "Install" : "Don't Install",
        input: {},
      });
    } else {
      const downloads = api.getState().persistent.downloads.files;

      const t = api.translate;

      const requiredInstalls = success.filter((dep) => dep.mod === undefined);
      const requiredDownloads = requiredInstalls.filter(
        (dep) =>
          dep.download === undefined ||
          [undefined, "paused"].includes(downloads[dep.download]?.state),
      );
      const requireEnableOnly = success.filter((dep) => dep.mod !== undefined);

      let bbcode = "";

      let list: string = "";
      if (requiredDownloads.length > 0) {
        list +=
          `[h4]${t("Require Download & Install")}[/h4]<br/>[list]` +
          requiredDownloads
            .map((mod) => "[*]" + renderModReference(mod.reference))
            .join("\n") +
          "[/list]<br/>";
      }
      const requireInstallOnly = requiredInstalls.filter(
        (mod) => !requiredDownloads.includes(mod),
      );
      if (requireInstallOnly.length > 0) {
        list +=
          `[h4]${t("Require Install")}[/h4]<br/>[list]` +
          requireInstallOnly
            .map((mod) => "[*]" + renderModReference(mod.reference))
            .join("\n") +
          "[/list]<br/>";
      }
      if (requireEnableOnly.length > 0) {
        list +=
          `[h4]${t("Will be enabled")}[/h4]<br/>[list]` +
          requireEnableOnly.map((mod) => "[*]" + modName(mod.mod)).join("\n") +
          "[/list]";
      }

      if (success.length > 0) {
        bbcode += t("{{modName}} requires the following dependencies:", {
          replace: { modName: name },
        });
      }

      if (error.length > 0) {
        bbcode +=
          "[color=red]" +
          t(
            "{{modName}} has unsolved dependencies that could not be found automatically. ",
            { replace: { modName: name } },
          ) +
          t("Please install them manually") +
          ":<br/>" +
          "{{errors}}" +
          "[/color]";
      }

      if (list.length > 0) {
        bbcode += "<br/>" + list;
      }

      const actions =
        success.length > 0
          ? [{ label: "Don't install" }, { label: "Install" }]
          : [{ label: "Close" }];

      return api.store
        .dispatch(
          showDialog(
            "question",
            t("Install Dependencies"),
            {
              bbcode,
              parameters: {
                modName: name,
                count: success.length,
                instCount: requiredInstalls.length,
                dlCount: requiredDownloads.length,
                errors: error.map((err) => err.error).join("<br/>"),
              },
              checkboxes: [
                {
                  id: "remember",
                  text: "Do this for all dependencies",
                  value: false,
                },
              ],
              options: {
                translated: true,
              },
            },
            actions,
          ),
        )
        .then((result) => {
          if (result.input["remember"]) {
            context.set("remember", result.action === "Install");
          }
          return result;
        });
    }
  }

  private addToPhaseStateCache = (api: IExtensionApi) => {
    return (download: IDownload) => {
      const activeCollectionSession = getCollectionActiveSession(
        api.getState(),
      );
      if (activeCollectionSession == null) {
        return;
      }
      this.ensurePhaseState(activeCollectionSession.collectionId);
      const phaseState = this.mInstallPhaseState.get(
        activeCollectionSession.collectionId,
      );
      if (phaseState === undefined) {
        return;
      }
      const cache = phaseState?.downloadLookupCache;
      if (cache === undefined) {
        return;
      }
      if (download.modInfo?.referenceTag !== undefined) {
        cache.byTag.set(download.modInfo.referenceTag, download.id);
      }
      if (download.fileMD5 !== undefined) {
        cache.byMd5.set(download.fileMD5, download.id);
      }
    };
  };

  private installDependenciesImpl(
    api: IExtensionApi,
    profile: IProfile,
    gameId: string,
    modId: string,
    name: string,
    rules: IModRule[],
    installPath: string,
    silent: boolean,
  ): Bluebird<void> {
    const filteredRules = filterDependencyRules(rules);

    if (filteredRules.length === 0) {
      api.events.emit("did-install-dependencies", gameId, modId, false);
      return Bluebird.resolve();
    }

    const notificationId = `${installPath}_activity`;

    if (!checkAndEmitDependencyInstallStart(api, gameId, modId, false)) {
      return Bluebird.resolve();
    }

    let lastProgress = -1;

    const progress = silent
      ? nop
      : (perc: number) => {
          // rounded to steps of 5%
          const newProgress = Math.round(perc * 20) * 5;
          if (newProgress !== lastProgress) {
            lastProgress = newProgress;
            api.sendNotification({
              id: notificationId,
              type: "activity",
              title: "Checking dependencies",
              message: "Resolving dependencies",
              progress: newProgress,
            });
          }
        };

    progress(0);
    api.store.dispatch(startActivity("dependencies", "gathering"));

    log("debug", "installing dependencies", { modId, name });
    return gatherDependencies(
      filteredRules,
      api,
      false,
      progress,
      this.addToPhaseStateCache(api),
    )
      .then((dependencies: IDependency[]) => {
        api.store.dispatch(stopActivity("dependencies", "gathering"));
        api.dismissNotification(notificationId);
        return this.doInstallDependencyList(
          api,
          profile,
          gameId,
          modId,
          name,
          dependencies,
          silent,
        );
      })
      .catch((err) => {
        api.dismissNotification(notificationId);
        api.store.dispatch(stopActivity("dependencies", "gathering"));
        if (!(err instanceof UserCanceled) && !(err instanceof NotFound)) {
          api.showErrorNotification("Failed to check dependencies", err);
        } else if (err instanceof NotFound) {
          api.showErrorNotification(
            "Failed to check dependencies",
            "A mod dependency could not be found. This is usually caused by " +
              "a temporary networking issue. Please try again later.",
            { allowReport: false },
          );
        }
      })
      .finally(() => {
        log("debug", "done installing dependencies", { gameId, modId });
        api.events.emit("did-install-dependencies", gameId, modId, false);
      });
  }

  private installRecommendationsQueryMain(
    api: IExtensionApi,
    modName: string,
    success: IDependency[],
    error: IDependencyError[],
    remember: boolean | null,
  ): Bluebird<IDialogResult> {
    if (remember === true) {
      return Bluebird.resolve({ action: "Install All", input: {} });
    } else if (remember === false) {
      return Bluebird.resolve({ action: "Skip", input: {} });
    }
    let bbcode: string = "";
    if (success.length > 0) {
      bbcode +=
        "{{modName}} recommends the installation of additional mods. " +
        "Please use the checkboxes below to select which to install.<br/><br/>[list]";
      for (const item of success) {
        bbcode += `[*] ${renderModReference(item.reference, undefined)}`;
      }

      bbcode += "[/list]";
    }

    if (error.length > 0) {
      bbcode +=
        "[color=red]" +
        "{{modName}} has unsolved dependencies that could not be found automatically. " +
        "Please install them manually." +
        "[/color][list]";
      for (const item of error) {
        bbcode += `[*] ${item.error}`;
      }
      bbcode += "[/list]";
    }

    return api.store.dispatch(
      showDialog(
        "question",
        "Install Recommendations",
        {
          bbcode,
          checkboxes: [
            {
              id: "remember",
              text: "Do this for all recommendations",
              value: false,
            },
          ],
          parameters: {
            modName,
          },
        },
        [
          { label: "Skip" },
          { label: "Manually Select" },
          { label: "Install All" },
        ],
      ),
    );
  }

  private installRecommendationsQuerySelect(
    api: IExtensionApi,
    modName: string,
    success: IDependency[],
  ): Bluebird<IDialogResult> {
    let bbcode: string = "";
    if (success.length > 0) {
      bbcode +=
        "{{modName}} recommends the installation of additional mods. " +
        "Please use the checkboxes below to select which to install.<br/><br/>";
    }

    const checkboxes: ICheckbox[] = success.map((dep, idx) => {
      let depName: string;
      if (dep.lookupResults.length > 0) {
        depName = dep.lookupResults[0].value.fileName;
      }
      if (depName === undefined) {
        depName = renderModReference(dep.reference, undefined);
      }

      let desc = depName;
      if (dep.download === undefined) {
        desc += " (" + api.translate("Not downloaded yet") + ")";
      }
      return {
        id: idx.toString(),
        text: desc,
        value: true,
      };
    });

    return api.store.dispatch(
      showDialog(
        "question",
        "Install Recommendations",
        {
          bbcode,
          checkboxes,
          parameters: {
            modName,
          },
        },
        [{ label: "Don't install" }, { label: "Continue" }],
      ),
    );
  }

  private installRecommendationsImpl(
    api: IExtensionApi,
    profile: IProfile,
    gameId: string,
    modId: string,
    name: string,
    rules: IRule[],
    installPath: string,
    silent: boolean,
  ): Bluebird<void> {
    const filteredRules = filterDependencyRules(rules);

    if (filteredRules.length === 0) {
      return Bluebird.resolve();
    }

    const notificationId = `${installPath}_activity`;

    if (!checkAndEmitDependencyInstallStart(api, gameId, modId, true)) {
      return Bluebird.resolve();
    }

    api.sendNotification({
      id: notificationId,
      type: "activity",
      message: "Checking dependencies",
    });
    api.store.dispatch(startActivity("dependencies", "gathering"));
    return gatherDependencies(
      filteredRules,
      api,
      true,
      undefined,
      this.addToPhaseStateCache(api),
    )
      .then((dependencies: Dependency[]) => {
        api.store.dispatch(stopActivity("dependencies", "gathering"));
        if (dependencies.length === 0) {
          return Bluebird.resolve();
        }

        interface IDependencySplit {
          success: IDependency[];
          existing: IDependency[];
          error: IDependencyError[];
        }
        const { success, existing, error } = dependencies.reduce(
          (prev: IDependencySplit, dep: Dependency) => {
            if (dep["error"] !== undefined) {
              prev.error.push(dep as IDependencyError);
            } else {
              const { mod } = dep as IDependency;
              if (
                mod === undefined ||
                !getSafe(profile?.modState, [mod.id, "enabled"], false)
              ) {
                prev.success.push(dep as IDependency);
              } else {
                prev.existing.push(dep as IDependency);
              }
            }
            return prev;
          },
          { success: [], existing: [], error: [] },
        );

        // all recommendations already installed
        if (success.length === 0 && error.length === 0) {
          return Bluebird.resolve();
        }
        const context = getBatchContext("install-recommendations", "", true);
        context.set<number>(
          "num-instructions",
          success.filter((succ) => succ.extra?.["instructions"] !== undefined)
            .length,
        );
        const remember = context.get<boolean>("remember", null);
        let queryProm: Bluebird<IDependency[]> = Bluebird.resolve(success);
        context.set("sourceModId", modId);

        if (!silent || error.length > 0) {
          queryProm = this.installRecommendationsQueryMain(
            api,
            name,
            success,
            error,
            remember,
          ).then((result) => {
            if (result.action === "Skip") {
              if (result.input?.remember) {
                context.set("remember", false);
              }
              return [];
            } else if (result.action === "Install All") {
              if (result.input?.remember) {
                context.set("remember", true);
              }
              return success;
            } else {
              return this.installRecommendationsQuerySelect(
                api,
                name,
                success,
              ).then((selectResult) => {
                if (selectResult.action === "Continue") {
                  return Object.keys(selectResult.input)
                    .filter((key) => selectResult.input[key])
                    .map((key) => success[parseInt(key, 10)]);
                } else {
                  return [];
                }
              });
            }
          });
        }

        return queryProm.then((result) => {
          return this.doInstallDependencies(
            api,
            gameId,
            modId,
            result,
            true,
            silent,
          ).then((updated) =>
            this.updateRules(
              api,
              gameId,
              modId,
              [].concat(existing, updated),
              true,
            ),
          );
        });
      })
      .catch((err) => {
        api.store.dispatch(stopActivity("dependencies", "gathering"));
        if (!(err instanceof UserCanceled)) {
          api.showErrorNotification("Failed to check dependencies", err);
        }
      })
      .finally(() => {
        api.dismissNotification(notificationId);
        api.events.emit("did-install-dependencies", gameId, modId, true);
      });
  }

  private withInstructions<T>(
    api: IExtensionApi,
    sourceName: string,
    title: string,
    id: string,
    instructions: string,
    recommendations: boolean,
    cb: () => Bluebird<T>,
  ): Bluebird<T> {
    if (!truthy(instructions)) {
      return cb();
    }

    if (recommendations) {
      return Bluebird.resolve(
        (async () => {
          const context = getBatchContext("install-recommendations", "");
          let action = context.get<string>("remember-instructions");
          const remaining = context.get<number>("num-instructions") - 1;

          if (action === null || action === undefined) {
            let checkboxes: ICheckbox[];
            if (remaining > 0) {
              checkboxes = [
                {
                  id: "remember",
                  value: false,
                  text: "Do this for all remaining instructions ({{remaining}} more)",
                },
              ];
            }
            const result = await api.showDialog(
              "info",
              title,
              {
                md: instructions,
                checkboxes,
                parameters: {
                  remaining,
                },
              },
              [{ label: "Skip" }, { label: "Install" }],
            );

            if (result.input["remember"]) {
              context.set("remember-instructions", result.action);
            }
            action = result.action;
          }

          context.set<number>("num-instructions", remaining);

          if (action === "Install") {
            return cb();
          } else {
            return Bluebird.reject(new UserCanceled(true));
          }
        })(),
      );
    } else {
      api.ext.showOverlay?.(
        `install-instructions-${id}`,
        title,
        instructions,
        undefined,
        {
          id,
        },
      );

      return cb();
    }
  }

  private installModAsync(
    requirement: IModReference,
    api: IExtensionApi,
    downloadId: string,
    modInfo?: any,
    fileList?: IFileListItem[],
    forceGameId?: string,
    silent?: boolean,
    sourceModId?: string,
  ): Bluebird<string> {
    return new Bluebird<string>(async (resolve, reject) => {
      const state = api.store.getState();
      const download: IDownload = state.persistent.downloads.files[downloadId];
      if (download === undefined) {
        return reject(new NotFound(renderModReference(requirement)));
      }
      const downloadGame: string[] = getDownloadGames(download);

      // Handle race condition: downloads may still be in Nexus domain ID folder while
      // installation expects internal ID folder. Try converted path first, fall back to original.
      const games = knownGames(state);
      const convertedGameId = convertGameIdReverse(games, downloadGame[0]);
      const pathGameId = convertedGameId || downloadGame[0];

      let fullPath: string = path.join(
        downloadPathForGame(state, pathGameId),
        download.localPath,
      );

      // If converted path doesn't exist and we have a different original ID, try original path
      if (convertedGameId && convertedGameId !== downloadGame[0]) {
        try {
          // Check if file exists at converted path
          await fs.statAsync(fullPath).catch(async () => {
            // File doesn't exist at converted path, try original Nexus domain ID path
            const originalPath = path.join(
              downloadPathForGame(state, downloadGame[0]),
              download.localPath,
            );
            try {
              await fs.statAsync(originalPath);
              fullPath = originalPath; // Use original path if it exists
            } catch (originalErr) {
              // Keep converted path if neither exists
            }
          });
        } catch (err) {
          // Continue with converted path if check fails
        }
      }
      this.install(
        downloadId,
        fullPath,
        downloadGame,
        api,
        { ...modInfo, download },
        false,
        silent,
        (error, id) => {
          if (error === null) {
            return resolve(id);
          } else {
            return reject(error);
          }
        },
        forceGameId,
        fileList,
        silent,
        undefined,
        false,
        sourceModId,
        requirement,
      );
    });
  }

  /**
   * extract an archive
   *
   * @export
   * @param {string} archivePath path to the archive file
   * @param {string} destinationPath path to install to
   */
  private async extractArchive(
    api: IExtensionApi,
    archivePath: string,
    tempPath: string,
    destinationPath: string,
    copies: IInstruction[],
    gameId: string,
  ): Promise<void> {
    const now = Date.now();
    // Strategy:
    //  - dedupe and pre-create parent directories once
    //  - link files in parallel with a bounded concurrency
    //  - if link fails (different fs, permission) fallback to copying
    //  - unlink sources in parallel after successful transfers
    const sorted = copies
      .slice()
      .sort((a, b) => a.destination.length - b.destination.length);
    const dirs = new Set<string>();
    const jobs: Array<{ src: string; dst: string; rel: string }> = [];
    const missingFiles = new Set<string>();

    const copyAsyncWrap = async (src: string, dst: string) => {
      try {
        await fs.copyAsync(src, dst);
      } catch (err) {
        if (
          err instanceof SelfCopyCheckError ||
          getErrorMessage(err)?.includes("and destination must")
        ) {
          // File is already there - don't care
          return;
        }
      }
    };

    for (const copy of sorted) {
      const src = path.join(tempPath, copy.source);
      const dst = path.join(destinationPath, copy.destination);
      dirs.add(path.dirname(dst));
      jobs.push({ src, dst, rel: copy.destination });
    }

    const cpuCount = os && os.cpus ? Math.max(1, os.cpus().length) : 1;
    const dirConcurrency = Math.min(64, Math.max(4, cpuCount * 2));
    const ioConcurrency = Math.min(256, Math.max(8, cpuCount * 8));

    try {
      // create parent directories
      await Bluebird.map(Array.from(dirs), (d) => fs.ensureDirAsync(d), {
        concurrency: dirConcurrency,
      });

      // perform hard links in parallel; fallback to copy on failure
      await Bluebird.map(
        jobs,
        async (job) => {
          try {
            await fs.linkAsync(job.src, job.dst);
          } catch (err) {
            const code = getErrorCode(err);
            if (code === "ENOENT") {
              // source file does not exist; skip
              missingFiles.add(job.src);
              return;
            }
            if (["EISDIR", "EEXIST"].includes(code)) {
              // destination exists (stale from a previous
              // failed install?) - remove it and fall back to copy
              await fs.removeAsync(job.dst);
              await copyAsyncWrap(job.src, job.dst);
            } else if (
              code &&
              ["EXDEV", "EPERM", "EACCES", "ENOTSUP"].includes(code)
            ) {
              await copyAsyncWrap(job.src, job.dst);
            } else {
              throw err;
            }
          }
        },
        { concurrency: ioConcurrency },
      );

      if (missingFiles.size > 0) {
        api.showErrorNotification(
          api.translate("Invalid installer"),
          api.translate(
            'The installer in "{{name}}" tried to install files that were ' +
              "not part of the archive.\n This can be due to an invalid mod or an invalid game extension installer.\n" +
              "Please report this to the mod author and/or the game extension developer.",
            { replace: { name: path.basename(archivePath) } },
          ) +
            "\n\n" +
            Array.from(missingFiles)
              .map((name) => "- " + name)
              .join("\n"),
          { allowReport: false },
        );
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    } finally {
      log("debug", "extraction completed", {
        duration: Date.now() - now,
        archivePath,
        instructions: copies.length,
      });
    }
  }

  /**
   * Find any download that matches the given mod reference using all available methods
   */
  private findDownloadForMod(
    reference: IModReference,
    downloads: { [id: string]: IDownload },
  ): string | null {
    const relevantDownloads = Object.fromEntries(
      Object.entries(downloads).filter(
        ([dlId, dl]) =>
          dl.state === "finished" && dl.game.includes(reference.gameId),
      ),
    );
    // Try the primary lookup first
    const downloadId = findDownloadByRef(reference, relevantDownloads);
    if (downloadId) {
      return downloadId;
    }

    // Try filename match
    const targetFilename = reference?.logicalFileName;
    if (targetFilename) {
      const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
        const download = relevantDownloads[dlId];
        return (
          download.localPath &&
          download.localPath.endsWith(targetFilename) &&
          download.state === "finished"
        );
      });
      if (altDownloadId) {
        return altDownloadId;
      }
    }

    // Try modId/fileId match
    if (reference?.repo) {
      const { modId, fileId } = reference.repo;
      if (modId && fileId) {
        const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
          const download = relevantDownloads[dlId];
          return (
            download.modInfo?.nexus?.ids?.modId?.toString() ===
              modId.toString() &&
            download.modInfo?.nexus?.ids?.fileId?.toString() ===
              fileId.toString() &&
            download.state === "finished"
          );
        });
        if (altDownloadId) {
          return altDownloadId;
        }
      }

      // Try modId only
      if (modId) {
        const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
          const download = relevantDownloads[dlId];
          return (
            download.modInfo?.nexus?.ids?.modId?.toString() ===
              modId.toString() && download.state === "finished"
          );
        });
        if (altDownloadId) {
          return altDownloadId;
        }
      }
    }

    // Try testRefByIdentifiers
    if (reference) {
      const altDownloadId = Object.keys(relevantDownloads).find((dlId) => {
        const download = relevantDownloads[dlId];
        if (download.state !== "finished") {
          return false;
        }

        const nameSet = new Set<string>();
        const fileIdsSet = new Set<string>();
        fileIdsSet.add(download.modInfo?.nexus?.ids?.fileId?.toString?.());
        nameSet.add(
          download.localPath
            ? path.basename(
                download.localPath,
                path.extname(download.localPath),
              )
            : undefined,
        );
        const identifiers = {
          fileNames: Array.from(nameSet).filter(truthy) as string[],
          fileIds: Array.from(fileIdsSet).filter(truthy) as string[],
          gameId:
            download.modInfo?.nexus?.ids?.gameId || download.modInfo?.gameId,
          modId: download.modInfo?.nexus?.ids?.modId,
          fileId: download.modInfo?.nexus?.ids?.fileId,
        };

        if (identifiers.modId && identifiers.fileId && identifiers.gameId) {
          return testRefByIdentifiers(identifiers, reference);
        }

        return false;
      });
      if (altDownloadId) {
        return altDownloadId;
      }
    }

    return null;
  }

  /**
   * Helper method to show aggregated error notification for dependency installation failures
   */
  private showDependencyError(
    api: IExtensionApi,
    sourceModId: string,
    title: string,
    details: string | Error,
    dependencyRef: string,
    options: { allowReport?: boolean; replace?: any; silent?: boolean } = {},
  ): void {
    const aggregationId = `install-dependencies-${sourceModId}`;

    // Don't allow reporting for user-initiated cancellations
    const isCanceled =
      details instanceof UserCanceled ||
      (details instanceof String &&
        ["usercanceled", "canceled", "cancelled"].some((term) =>
          details.toLowerCase().includes(term),
        ));
    const allowReport = isCanceled ? false : options.allowReport;

    if (this.mNotificationAggregator.isAggregating(aggregationId)) {
      this.mNotificationAggregator.addNotification(
        aggregationId,
        "error",
        title,
        details,
        dependencyRef,
        { allowReport },
      );
    } else {
      api.showErrorNotification(title, details, {
        id: `failed-install-dependency-${dependencyRef}`,
        message: dependencyRef,
        allowReport,
        replace: options.replace,
      });
    }
  }
}

export default InstallManager;
