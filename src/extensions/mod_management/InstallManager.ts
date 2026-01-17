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
 * ## Phase State (PhaseManager)
 *
 * Phase state is now managed by the PhaseManager class (./install/PhaseManager.ts).
 * Key state includes:
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
import { withContext } from "../../util/errorHandling";
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
import type { IDownload } from "../download_management/types/IDownload";
import getDownloadGames from "../download_management/util/getDownloadGames";

import { discoveryByGame } from "../gamemode_management/selectors";
import { getGame } from "../gamemode_management/util/getGame";
import modName, { renderModReference } from "../mod_management/util/modName";
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
import {
  InstructionGroups,
  findDownloadByReferenceTag,
  getReadyDownloadId,
  getModsByPhase,
  filterDependencyRules,
  isBrowserAssistantError,
  isFileInUse,
  isCritical,
  FILETYPES_AVOID,
  splitDependencies,
  isDependencyError,
  logDependencyResults,
  InstallOrchestrator,
  DEFAULT_INSTALL_CONFIG,
  UserDialogManager,
  validateVariantName,
  INSTALL_ACTION,
  REPLACE_ACTION,
  hasFuzzyReference,
  checkModVariantsExist,
  checkModNameExists,
  findPreviousVersionMod,
  findDownloadForMod,
  InstallerSelector,
  reportUnsupported,
  showMemoDialog,
  installRecommendationsQueryMain,
  installRecommendationsQuerySelect,
  updateModRule as updateModRuleUtil,
  updateRules as updateRulesUtil,
  DownloadEventHandler,
  findCollectionByDownload,
  downloadURL as downloadURLUtil,
  downloadMatching as downloadMatchingUtil,
  downloadDependencyAsync as downloadDependencyAsyncUtil,
  applyExtraFromRule as applyExtraFromRuleUtil,
  dropUnfulfilled as dropUnfulfilledUtil,
  checkCollectionPhaseStatus as checkCollectionPhaseStatusUtil,
  canStartInstallationTasks as canStartInstallationTasksUtil,
  PhaseCoordinator,
  InstallationQueueManager,
  DependencyPhaseExecutor,
  DependencyInstallOrchestrator,
  processAttribute as processAttributeUtil,
  processEnableAllPlugins as processEnableAllPluginsUtil,
  processSetModType as processSetModTypeUtil,
  processRule as processRuleUtil,
  InstructionProcessor,
  ModNamingStateMachine,
  applyNamingResult,
  InstallErrorHandler,
  createErrorContext,
} from "./install";
import type { IDependencySplit, IInstallConfig } from "./install";
import type { IActiveInstallation, IDeploymentDetails } from "./install";
import type {
  IProcessContext,
  IInstructionCallbacks,
  INamingContext,
  IErrorContext,
} from "./install";
import makeListInstaller from "./listInstaller";
import { STAGING_DIR_TAG } from "./stagingDirectory";

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
} from "../../shared/errors";

// IActiveInstallation interface moved to ./install/types/IInstallationEntry.ts
// IDeploymentDetails interface moved to ./install/types/IPhaseState.ts

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

// InstructionGroups class extracted to ./install/InstructionGroups.ts

export const INI_TWEAKS_PATH = "Ini Tweaks";

// Re-export from UserDialogManager for backward compatibility
export { INSTALL_ACTION, REPLACE_ACTION, validateVariantName };
export const VARIANT_ACTION = "Add Variant";

// archiveExtLookup moved to ./install/types/IInstallConfig.ts as ARCHIVE_EXTENSIONS
// FILETYPES_AVOID moved to ./install/types/IInstallConfig.ts

function nop() {
  // nop
}

// findDownloadByReferenceTag extracted to ./install/helpers.ts

// getReadyDownloadId extracted to ./install/helpers.ts

// getModsByPhase extracted to ./install/helpers.ts

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

// findCollectionByDownload extracted to ./install/DownloadEventHandler.ts
// filterDependencyRules extracted to ./install/helpers.ts

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

// validateVariantName extracted to ./install/UserDialogManager.ts

/**
 * central class for the installation process
 *
 * @class InstallManager
 */
class InstallManager {
  // Centralized configuration - eliminates magic numbers
  private mConfig: IInstallConfig = DEFAULT_INSTALL_CONFIG;

  private mApi: IExtensionApi;
  private mInstallers: IModInstaller[] = [];
  private mGetInstallPath: (gameId: string) => string;
  private mDependencyInstalls: { [modId: string]: () => void } = {};
  private mDependencyDownloadsLimit: DynamicDownloadConcurrencyLimiter;

  private mNotificationAggregator: NotificationAggregator;

  // This limiter drives the DownloadManager to queue up new downloads.
  private mDependencyInstallsLimit: ConcurrencyLimiter;

  // Installation orchestrator - coordinates all extracted components
  // Owns: InstallationTracker, PhaseManager, ArchiveExtractor, InstructionProcessor
  private mOrchestrator: InstallOrchestrator = new InstallOrchestrator();

  // User dialog manager - handles installation-related user dialogs
  private mUserDialogManager: UserDialogManager;

  // Installer selector - handles installer selection and mod type determination
  private mInstallerSelector: InstallerSelector;

  // Download event handler - handles download completion events for collections
  private mDownloadEventHandler: DownloadEventHandler;

  // Phase coordinator - handles phase-gated collection installation coordination
  private mPhaseCoordinator: PhaseCoordinator;

  // Installation queue manager - handles queuing and executing installations
  private mInstallationQueueManager: InstallationQueueManager;

  // Dependency phase executor - handles executing single phases of dependency installation
  private mDependencyPhaseExecutor: DependencyPhaseExecutor;

  // Dependency install orchestrator - coordinates dependency installation across phases
  private mDependencyInstallOrchestrator: DependencyInstallOrchestrator;

  // Installation tracker - delegates to orchestrator for backward compatibility
  private get mTracker() {
    return this.mOrchestrator.getTracker();
  }

  // Main installation concurrency limiter - replaces sequential mQueue
  private mMainInstallsLimit: ConcurrencyLimiter;

  constructor(api: IExtensionApi, installPath: (gameId: string) => string) {
    this.mApi = api;
    this.mGetInstallPath = installPath;
    this.mDependencyDownloadsLimit = new DynamicDownloadConcurrencyLimiter(api);
    this.mNotificationAggregator = new NotificationAggregator(api);
    this.mUserDialogManager = new UserDialogManager(api);
    this.mInstallerSelector = new InstallerSelector(this.mInstallers);

    // Initialize concurrency limiters with config values (must be before queue manager)
    this.mDependencyInstallsLimit = new ConcurrencyLimiter(
      this.mConfig.concurrency.maxDependencyInstalls,
    );
    this.mMainInstallsLimit = new ConcurrencyLimiter(
      this.mConfig.concurrency.maxSimultaneousInstalls,
    );

    // Initialize installation queue manager with callbacks to InstallManager methods
    this.mInstallationQueueManager = new InstallationQueueManager(
      api,
      this.mPhaseManager,
      this.mTracker,
      this.mDependencyInstallsLimit,
      this.mMainInstallsLimit,
      {
        withInstructions: this.withInstructions.bind(this),
        installModAsync: this.installModAsync.bind(this),
        showDependencyError: this.showDependencyError.bind(this),
        getModName: modName,
      },
      { maxRetries: this.mConfig.concurrency.maxRetries },
    );

    // Initialize download event handler with callbacks to InstallManager methods
    this.mDownloadEventHandler = new DownloadEventHandler(
      this.mPhaseManager,
      this.mTracker,
      this.mNotificationAggregator,
      {
        isDependencyInstalling: (collectionId: string) =>
          !!this.mDependencyInstalls[collectionId],
        queueInstallation:
          this.mInstallationQueueManager.queueInstallation.bind(
            this.mInstallationQueueManager,
          ),
        markPhaseDownloadsFinished: (
          sourceModId: string,
          phase: number,
          api: IExtensionApi,
        ) =>
          this.mPhaseCoordinator.markPhaseDownloadsFinished(
            sourceModId,
            phase,
            api,
          ),
        maybeAdvancePhase: (sourceModId: string, api: IExtensionApi) =>
          this.mPhaseCoordinator.maybeAdvancePhase(sourceModId, api),
        generateInstallKey: this.mTracker.generateInstallKey.bind(
          this.mTracker,
        ),
      },
    );

    // Initialize phase coordinator with callbacks to InstallManager methods
    this.mPhaseCoordinator = new PhaseCoordinator(
      api,
      this.mPhaseManager,
      this.mTracker,
      this.mDownloadEventHandler,
      {
        isDependencyInstallActive: (sourceModId: string) =>
          !!this.mDependencyInstalls[sourceModId],
        scheduleDeployOnPhaseSettled:
          this.scheduleDeployOnPhaseSettled.bind(this),
        cleanupPendingInstalls:
          this.mInstallationQueueManager.cleanupPendingInstalls.bind(
            this.mInstallationQueueManager,
          ),
      },
      { pollIntervalMs: this.mConfig.timing.pollIntervalMs },
    );

    // Initialize dependency phase executor with callbacks to InstallManager methods
    this.mDependencyPhaseExecutor = new DependencyPhaseExecutor(
      api,
      this.mPhaseManager,
      this.mPhaseCoordinator,
      this.mTracker,
      this.mDownloadEventHandler,
      this.mInstallationQueueManager,
      {
        showDependencyError: this.showDependencyError.bind(this),
        getDependencyAbort: (sourceModId: string) =>
          this.mDependencyInstalls[sourceModId],
        setDependencyAbort: (sourceModId: string, abort: () => void) => {
          this.mDependencyInstalls[sourceModId] = abort;
        },
        deleteDependencyAbort: (sourceModId: string) => {
          delete this.mDependencyInstalls[sourceModId];
        },
      },
    );

    // Initialize dependency install orchestrator
    this.mDependencyInstallOrchestrator = new DependencyInstallOrchestrator(
      api,
      this.mPhaseManager,
      this.mPhaseCoordinator,
      this.mDependencyPhaseExecutor,
      this.mDownloadEventHandler,
      this.mInstallationQueueManager,
      this.mDependencyDownloadsLimit,
      this.mDependencyInstallsLimit,
      {
        withInstructions: this.withInstructions.bind(this),
        installModAsync: this.installModAsync.bind(this),
        updateModRule: this.updateModRuleMethod.bind(this),
        getDependencyAbort: (sourceModId: string) =>
          this.mDependencyInstalls[sourceModId],
        setDependencyAbort: (sourceModId: string, abort: () => void) => {
          this.mDependencyInstalls[sourceModId] = abort;
        },
        deleteDependencyAbort: (sourceModId: string) => {
          delete this.mDependencyInstalls[sourceModId];
        },
      },
    );

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

      // Retry counters are now managed by InstallationQueueManager

      return Bluebird.resolve();
    });

    api.events.on(
      "did-finish-download",
      (downloadId: string, state: string) => {
        if (state === "finished") {
          const context = getBatchContext("install-recommendations", "");
          const sourceModId = context?.get?.("sourceModId", null);
          this.mDownloadEventHandler.handleDownloadFinished(
            api,
            downloadId,
            sourceModId,
          );
        } else if (state === "failed") {
          this.mDownloadEventHandler.handleDownloadFailed(api, downloadId);
        }
      },
    );
  }

  /**
   * Get information about all currently active installations
   */
  public getActiveInstallations(): IActiveInstallation[] {
    return this.mTracker.getActiveInstallations();
  }

  /**
   * Get information about a specific active installation
   */
  public getActiveInstallation(
    installId: string,
  ): IActiveInstallation | undefined {
    return this.mTracker.getActive(installId);
  }

  /**
   * Check if an installation is currently active
   */
  public isInstallationActive(installId: string): boolean {
    return this.mTracker.hasActive(installId);
  }

  /**
   * Get count of active installations
   */
  public getActiveInstallationCount(): number {
    return this.mTracker.getActiveCount();
  }

  /**
   * Debug method: Get details about active installations
   */
  public debugActiveInstalls(): any[] {
    return this.mTracker.debugActiveInstalls();
  }

  /**
   * Force cleanup of stuck installations (for debugging)
   * @param maxAgeMinutes - installations older than this will be force-cleaned
   */
  public forceCleanupStuckInstalls(
    api: IExtensionApi,
    maxAgeMinutes: number = DEFAULT_INSTALL_CONFIG.cleanup
      .stuckInstallMaxAgeMinutes,
  ): number {
    return this.mTracker.forceCleanupStuckInstalls(api, maxAgeMinutes);
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
          () => this.mUserDialogManager.queryPassword(api.store) as any,
        )
        .catch((err: Error) =>
          isCritical(err.message)
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
        if (code !== 0) {
          log("warn", "extraction reported error", {
            code,
            errors: errors.join("; "),
          });
          const critical = errors.find((err) => isCritical(err));
          if (critical !== undefined) {
            return Bluebird.reject(
              new ArchiveBrokenError(path.basename(archivePath), critical),
            );
          }
          return this.mUserDialogManager.queryContinue(errors, archivePath);
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
          return this.mInstallerSelector.getInstaller(
            fileList,
            gameId,
            archivePath,
          );
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
    const installId = this.mTracker.generateInstallKey(sourceModId, archiveId);
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
    this.mTracker.setActive(installId, installInfo);

    // Wrap callback to ensure proper cleanup and tracking
    const trackedCallback = (err: Error, id: string) => {
      const activeInstall = this.mTracker.getActive(installId);
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
      this.mTracker.deleteActive(installId);
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
          const fullInfo = { ...info };
          let rules: IRule[] = [];
          let overrides: string[] = [];
          let destinationPath: string;
          let tempPath: string;
          // Use the already-created installation tracking
          const activeInstall = this.mTracker.getActive(installId);
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
            const activeInstall = this.mTracker.getActive(installId);
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
              .tap(() => {
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
                  return Promise.resolve();
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

                modId = this.mInstallerSelector.deriveInstallName(
                  baseName,
                  fullInfo,
                );

                // Use state machine to resolve naming conflicts
                // (replaces recursive checkNameLoop function)
                const namingContext: INamingContext = {
                  api,
                  gameId: installGameId,
                  archiveId,
                  modId,
                  variantCounter: 0,
                  replacementChoice: undefined,
                  unattended,
                  fileList,
                  choices: fullInfo.choices,
                  patches: fullInfo.patches,
                };

                const namingStateMachine = new ModNamingStateMachine(
                  this.mUserDialogManager,
                );
                return namingStateMachine.resolve(namingContext);
              })
              .then((namingResult) => {
                // Apply side effects from naming resolution
                const fileListRef = { current: fileList };
                const applied = applyNamingResult(
                  namingResult,
                  fullInfo,
                  fileListRef,
                );
                fileList = fileListRef.current;
                enable = applied.enable || enable;
                rules = applied.rules;
                return applied.modId;
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
                    ? findPreviousVersionMod(
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
                  return this.mUserDialogManager.queryIgnoreDependent(
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
                  return this.mUserDialogManager
                    .userVersionChoice(existingMod, api.store)
                    .then((action: string) => {
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
                    });
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
                  return this.mInstallerSelector
                    .determineModType(installGameId, result.instructions)
                    .then((type) => {
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
                  ).tap(() => {
                    const endTime = Date.now();
                    log("debug", "processed instructions", {
                      installId: activeInstall.installId,
                      duration: endTime - startTime,
                    });
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
                // Use strategy-based error handler for cleaner error handling
                const errorContext: IErrorContext = createErrorContext(
                  api,
                  archivePath,
                  archiveId,
                  destinationPath,
                  installContext,
                  unattended,
                  info,
                  promiseCallback,
                );
                const errorHandler = new InstallErrorHandler();
                return errorHandler.handle(err, errorContext);
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
              if (this.mTracker.hasActive(installId)) {
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
                this.mTracker.deleteActive(installId);
                resolve(modId);
              }
            })
            .catch((installError) => {
              if (this.mTracker.hasActive(installId)) {
                log("warn", "Installation failed", {
                  installId,
                  error: installError.message,
                });
                this.mTracker.deleteActive(installId);
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
      this.mConfig.timing.notificationAggregationMs,
    );

    return withActivityTracking(
      api,
      "installing_dependencies",
      mod.id,
      this.withDependenciesContext("install-dependencies", profile.id, () =>
        Bluebird.resolve(mod.rules ?? []).then((rules) =>
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
        Bluebird.resolve(mod.rules ?? [])
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

  // Installation queue methods extracted to InstallationQueueManager
  // See ./install/InstallationQueueManager.ts for implementation

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
  // Phase manager - delegates to orchestrator for backward compatibility
  // See ./install/PhaseManager.ts for implementation details
  private get mPhaseManager() {
    return this.mOrchestrator.getPhaseManager();
  }

  // Schedule a deploy once all installers for a specific phase have finished
  public scheduleDeployOnPhaseSettled(
    api: IExtensionApi,
    sourceModId: string,
    phase: number,
    deployOnSettle?: boolean,
  ): Promise<void> | undefined {
    this.mPhaseManager.ensureState(sourceModId);

    if (this.mPhaseManager.isPhaseDeployed(sourceModId, phase)) {
      // Phase already deployed, nothing to do
      return;
    }

    // Only schedule deployment for phases that are allowed to be processed
    const allowedPhase = this.mPhaseManager.getAllowedPhase(sourceModId);
    if (allowedPhase !== undefined && phase > allowedPhase) {
      return;
    }

    const existing = this.mPhaseManager.getDeploymentPromise(
      sourceModId,
      phase,
    );
    if (existing) {
      if (deployOnSettle && !existing.deployOnSettle) {
        this.mPhaseManager.setDeploymentPromise(sourceModId, phase, {
          deploymentPromise: existing.deploymentPromise,
          deployOnSettle: true,
        });
      }
      // Return the existing promise so callers can await it
      return existing.deploymentPromise;
    }

    // Track deployment promise so we can wait for it before cleanup
    // Convert Bluebird to native Promise for compatibility
    const deploymentPromise = Promise.resolve(
      this.mPhaseCoordinator
        .pollPhaseSettlement(api, sourceModId, { phase })
        .catch((err) => {
          log("warn", "Error during scheduled phase deployment", {
            sourceModId,
            phase,
            error: err?.message,
          });
        })
        .finally(() => {
          // Remove this promise from the array when it completes
          this.mPhaseManager.deleteDeploymentPromise(sourceModId, phase);
        }),
    );

    // Add to tracked deployment promises
    this.mPhaseManager.setDeploymentPromise(sourceModId, phase, {
      deploymentPromise,
      deployOnSettle: deployOnSettle ?? false,
    });
    return deploymentPromise;
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
        hasFuzzyReference(rule.reference)
      ) {
        const newRule: IModRule = JSON.parse(JSON.stringify(rule));
        api.store.dispatch(removeModRule(gameId, mod.id, rule));
        delete newRule.reference.id;
        api.store.dispatch(addModRule(gameId, mod.id, newRule));
      }
    });
  }

  // Error classification methods extracted to ./install/errors/errorClassification.ts
  // Now using imported functions: isBrowserAssistantError, isCritical, isFileInUse
  // Archive extraction with retry logic now handled by ArchiveExtractor

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

    // Use the orchestrator's ArchiveExtractor for extraction with retry logic
    const extractProm = this.mOrchestrator
      .getExtractor()
      .extract(archivePath, tempPath, {
        onProgress: progress,
        queryPassword: async () =>
          this.mUserDialogManager.queryPassword(api.store),
      });

    return extractProm
      .then(
        async ({
          code,
          errors,
          durationMs,
        }: {
          code: number;
          errors: string[];
          durationMs: number;
        }) => {
          log("debug", "extraction completed", {
            archivePath: path.basename(archivePath),
            extractionTimeMs: durationMs,
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
            const critical = errors.find((err) => isCritical(err));
            if (critical !== undefined) {
              throw new ArchiveBrokenError(
                path.basename(archivePath),
                critical,
              );
            }
            await this.mUserDialogManager.queryContinue(errors, archivePath);
          }
        },
      )
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
      .finally(() => {
        // process.noAsar = false;
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
              throw new ProcessCanceled(
                "User declined to install mod with C# scripts",
              );
            //throw new UserCanceled();
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
          const supportedInstaller = await this.mInstallerSelector.getInstaller(
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

  // Also available as InstructionProcessor.validateInstructions() for standalone use
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

  // Also available as InstructionProcessor.transformInstructions() for standalone use
  private transformInstructions(input: IInstruction[]): InstructionGroups {
    return input.reduce((prev, value) => {
      if (truthy(value) && prev[value.type] !== undefined) {
        prev[value.type].push(value);
      }
      return prev;
    }, new InstructionGroups());
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
      return this.installInner(
        api,
        mod.path,
        tempPath,
        destinationPath,
        gameId,
        subContext,
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
        return Bluebird.reject(new ProcessCanceled("Installer script failed"));
      }
    }

    // Use the InstructionProcessor to handle all instruction types
    const processor = this.mOrchestrator.getInstructionProcessor();
    const ctx: IProcessContext = {
      api,
      archivePath,
      tempPath,
      destinationPath,
      gameId,
      modId,
      choices,
      unattended,
    };

    const callbacks: IInstructionCallbacks = {
      processAttribute: (api, instructions, gameId, modId) =>
        Bluebird.resolve(
          processAttributeUtil(api, instructions, gameId, modId),
        ),
      processEnableAllPlugins: (api, instructions, gameId, modId) =>
        Bluebird.resolve(
          processEnableAllPluginsUtil(api, instructions, gameId, modId),
        ),
      processSetModType: (api, instCtx, instructions, gameId, modId) =>
        Bluebird.resolve(
          processSetModTypeUtil(api, instCtx, instructions, gameId, modId),
        ),
      processRule: (api, instructions, gameId, modId) =>
        processRuleUtil(api, instructions, gameId, modId),
      enableIniTweak: (api, gameId, modId, tweakId) =>
        api.store.dispatch(setINITweakEnabled(gameId, modId, tweakId, true)),
      processSubmodule: (instruction, subCtx) =>
        this.processSubmodule(
          subCtx.api,
          installContext,
          [instruction],
          subCtx.destinationPath,
          subCtx.gameId,
          subCtx.modId,
          subCtx.choices,
          subCtx.unattended,
          details,
        ),
      reportUnsupported: (api, instructions, archivePath) =>
        reportUnsupported(api, instructions, archivePath),
    };

    return Bluebird.resolve(
      processor.processAll(instructionGroups, ctx, installContext, callbacks),
    );
  }

  // Delegates to DependencyInstaller
  private updateModRuleMethod(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dep: IDependency,
    reference: IModReference,
    recommended: boolean,
  ) {
    return updateModRuleUtil(
      api,
      gameId,
      sourceModId,
      dep,
      reference,
      recommended,
    );
  }

  // Delegates to DependencyInstaller
  private updateRules(
    api: IExtensionApi,
    gameId: string,
    sourceModId: string,
    dependencies: IDependency[],
    recommended: boolean,
  ): Bluebird<void> {
    return updateRulesUtil(api, gameId, sourceModId, dependencies, recommended);
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

    // get updated mod state
    const modState =
      profile !== undefined
        ? (api.getState().persistent.profiles[profile.id]?.modState ?? {})
        : {};

    const mods = api.getState().persistent.mods?.[gameId] ?? {};

    // Split dependencies using extracted utility
    const isModEnabled = (modId: string) => modState[modId]?.enabled ?? false;
    const testModMatch = (mod: IMod, ref: IModReference) => {
      // If mod doesn't exist in state, consider it a match (won't trigger re-install)
      if (!mods[mod.id]) {
        return true;
      }
      return testModReference(mods[mod.id], ref);
    };

    const { success, existing, error } = splitDependencies(
      dependencies,
      isModEnabled,
      testModMatch,
    );

    logDependencyResults(
      { success, existing, error },
      "installDependenciesImpl",
    );

    if (silent && error.length === 0) {
      return this.mDependencyInstallOrchestrator
        .orchestrate(api, gameId, modId, success, false, silent)
        .then((updated) =>
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

    return showMemoDialog(api, context, name, success, error).then((result) => {
      if (result.action === "Install") {
        return this.mDependencyInstallOrchestrator
          .orchestrate(api, gameId, modId, success, false, silent)
          .then((updated) =>
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
    });
  }

  private addToPhaseStateCache = (api: IExtensionApi) => {
    return (download: IDownload) => {
      const activeCollectionSession = getCollectionActiveSession(
        api.getState(),
      );
      if (activeCollectionSession == null) {
        return;
      }
      const collectionId = activeCollectionSession.collectionId;
      this.mPhaseManager.ensureState(collectionId);
      if (!this.mPhaseManager.hasState(collectionId)) {
        return;
      }
      if (download.modInfo?.referenceTag !== undefined) {
        this.mPhaseManager.cacheDownloadByTag(
          collectionId,
          download.modInfo.referenceTag,
          download.id,
        );
      }
      if (download.fileMD5 !== undefined) {
        this.mPhaseManager.cacheDownloadByMd5(
          collectionId,
          download.fileMD5,
          download.id,
        );
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

        // Split dependencies using extracted utility (no version matching for recommendations)
        const isModEnabled = (modId: string) =>
          getSafe(profile?.modState, [modId, "enabled"], false);
        const alwaysMatch = () => true; // Skip version matching for recommendations

        const { success, existing, error } = splitDependencies(
          dependencies,
          isModEnabled,
          alwaysMatch,
        );

        logDependencyResults(
          { success, existing, error },
          "installRecommendationsImpl",
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
          queryProm = installRecommendationsQueryMain(
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
              return installRecommendationsQuerySelect(api, name, success).then(
                (selectResult) => {
                  if (selectResult.action === "Continue") {
                    return Object.keys(selectResult.input)
                      .filter((key) => selectResult.input[key])
                      .map((key) => success[parseInt(key, 10)]);
                  } else {
                    return [];
                  }
                },
              );
            }
          });
        }

        return queryProm.then((result) => {
          return this.mDependencyInstallOrchestrator
            .orchestrate(api, gameId, modId, result, true, silent)
            .then((updated) =>
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

    if (this.mNotificationAggregator.isAggregating(aggregationId)) {
      this.mNotificationAggregator.addNotification(
        aggregationId,
        "error",
        title,
        details,
        dependencyRef,
        { allowReport: options.allowReport },
      );
    } else {
      api.showErrorNotification(title, details, {
        id: `failed-install-dependency-${dependencyRef}`,
        message: dependencyRef,
        allowReport: options.allowReport,
        replace: options.replace,
      });
    }
  }
}

export default InstallManager;
