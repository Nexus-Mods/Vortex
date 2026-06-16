import * as path from "path";

/* eslint-disable */
import * as nexusApi from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";
import Bluebird from "bluebird";
import * as _ from "lodash";

import * as installActions from "../../../actions/collectionInstallTracking";
import { log } from "../../../logging";
import type {
  CollectionModStatus,
  ICollectionModInstallInfo,
} from "../../../types/collections/ICollectionInstallSession";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import {
  generateCollectionSessionId,
  modRuleId,
  reconstructModStatus,
} from "../../../util/collectionInstallSession";
import Debouncer from "../../../util/Debouncer";
import { getSafe, setSafe } from "../../../util/storeHelper";
import { batchDispatch } from "../../../util/util";
import {
  CollectionsInstallationCompletedEvent,
  CollectionsInstallationFailedEvent,
  CollectionsInstallationStartedEvent,
} from "../../analytics/mixpanel/MixpanelEvents";
import type { IDownload } from "../../download_management/types/IDownload";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";
import { addModRule, setFileOverride, setModAttribute } from "../../mod_management/actions/mods";
import { installPathForGame } from "../../mod_management/selectors";
import type { IMod, IModReference, IModRule } from "../../mod_management/types/IMod";
import { findDownloadByRef, lookupFromDownload } from "../../mod_management/util/dependencies";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { isFuzzyVersion } from "../../mod_management/util/isFuzzyVersion";
import renderModName from "../../mod_management/util/modName";
import testModReference, {
  ruleInstallSpec,
  testRefByIdentifiers,
} from "../../mod_management/util/testModReference";
import { nexusIdsFromDownloadId } from "../../nexus_integration/selectors";
import { setModEnabled } from "../../profile_management/actions/profiles";
import { activeGameId, profileById } from "../../profile_management/selectors";
import type { IProfile } from "../../profile_management/types/IProfile";
import { setPendingVote } from "../actions/persistent";
import { INSTALLING_NOTIFICATION_ID, MOD_TYPE } from "../constants";
import { postprocessCollection } from "../postprocessCollection";
import { ICollection } from "../types/ICollection";
import { IRevisionEx } from "../types/IRevisionEx";
import { applyPatches } from "./binaryPatching";
import InfoCache from "./InfoCache";
import { readCollection } from "./readCollection";
import { calculateCollectionSize, getUnfulfilledNotificationId, isRelevant } from "./util";

export type Step =
  | "prepare"
  | "changelog"
  | "query"
  | "start"
  | "disclaimer"
  | "installing"
  | "recommendations"
  | "review";

export type UpdateCB = () => void;

class InstallDriver {
  private mApi: IExtensionApi;
  private mProfile: IProfile;
  private mGameId: string;
  private mCollection: IMod;
  private mLastCollection: IMod;
  private mStep: Step = "prepare";
  private mUpdateHandlers: UpdateCB[] = [];
  private mInstalledMods: IMod[] = [];
  private mDependentMods: IModRule[] = [];
  private mInstallingMod: string;
  private mInstallDone: boolean = false;
  private mCollectionInfo: nexusApi.ICollection;
  private mRevisionInfo: nexusApi.IRevision;
  private mInfoCache: InfoCache;
  private mTotalSize: number;
  private mOnStop: () => void;
  private mPrepare: Bluebird<void> = Bluebird.resolve();
  private mTimeStarted: number;
  private mPostprocessing: boolean = false;

  private mStateUpdates: any[] = [];
  private mModStatusDebouncer: Debouncer = new Debouncer(
    () => {
      const actions = this.mStateUpdates.slice();
      this.mStateUpdates = [];
      batchDispatch(this.mApi.store, actions);
      return Bluebird.resolve();
    },
    100,
    false,
    false,
  );

  // Throttle the progress notification to avoid flooding Redux/UI on every
  // single mod event.  Tracking dispatches (mModStatusDebouncer) are unaffected.
  // reset=false keeps it from starving, triggerImmediately=true shows instant
  // feedback on the first event.
  private mProgressDebouncer: Debouncer = new Debouncer(
    () => {
      if (this.mProfile && this.mGameId && this.mCollection) {
        this.updateProgress(this.mProfile, this.mGameId, this.mCollection);
      }
      return Bluebird.resolve();
    },
    1000,
    false,
    true,
  );

  // Collection installation tracking
  private mCurrentSessionId: string;
  private mTrackingEnabled: boolean = true;
  private get requiredMods() {
    return this.mDependentMods.filter((m) => m.type === "requires");
  }
  private get recommendedMods() {
    return this.mDependentMods.filter((m) => m.type === "recommends");
  }

  public updateModTracking(rule: IModRule, status: CollectionModStatus) {
    if (!this.mTrackingEnabled || !this.mCurrentSessionId) {
      return;
    }

    if (status === "installed") {
      // 'installed' status should be set via markModInstalledInTracking
      log("warn", "use markModInstalledInTracking to set status to installed");
      return;
    }

    const ruleId = modRuleId(rule);

    // Check current status to prevent downgrades from terminal states
    const state = this.mApi.getState();
    const currentSession = state.session["collections"]?.activeSession;
    const currentStatus = currentSession?.mods?.[ruleId]?.status;

    // Don't downgrade from terminal states (installed, skipped, failed)
    const terminalStates: CollectionModStatus[] = ["installed", "ignored", "failed"];
    if (currentStatus && terminalStates.includes(currentStatus)) {
      return;
    }

    this.mStateUpdates.push(installActions.updateModStatus(this.mCurrentSessionId, ruleId, status));
    this.mModStatusDebouncer.schedule();
  }

  public markModInstalledInTracking(rule: IModRule, modId: string) {
    if (!this.mTrackingEnabled || !this.mCurrentSessionId) {
      return;
    }

    const ruleId = modRuleId(rule);
    this.mStateUpdates.push(installActions.markModInstalled(this.mCurrentSessionId, ruleId, modId));
    this.mModStatusDebouncer.schedule();
  }

  /**
   * Mark a collection rule as ignored. Updates the transient install session and
   * persists the decision durably via the rule's `ignored` flag. The session lives
   * in state.session (not persisted), so without the durable flag a mid-install
   * restart would rehydrate an ignored required mod as "pending" and the collection
   * could never reach completion. startImpl()'s reconstruction reads `ignored` to
   * restore the "ignored" status; the unfulfilled-rules and dependency-completion
   * checks already treat ignored rules as resolved.
   */
  private markRuleIgnored(rule: IModRule) {
    this.updateModTracking(rule, "ignored");

    if (this.mGameId !== undefined && this.mCollection !== undefined) {
      this.mApi.store.dispatch(
        addModRule(this.mGameId, this.mCollection.id, { ...rule, ignored: true }),
      );
    }
  }

  private completeInstallationTracking(success: boolean) {
    if (!this.mTrackingEnabled || !this.mCurrentSessionId) {
      return;
    }

    this.mStateUpdates.push(installActions.finishInstallSession(this.mCurrentSessionId, success));
    this.mModStatusDebouncer.schedule();
    this.mCurrentSessionId = undefined;
  }

  private mDebounce: Debouncer = new Debouncer(
    (collectionSlug: string, revisionNumber: number, error: Error | undefined) => {
      // this.mApi.events.emit('analytics-track-event-with-payload', 'Collection Installation Failed', {
      //   collection_slug: collectionSlug,
      //   collection_revision_number: revisionNumber,
      // });

      const nexusIds = nexusIdsFromDownloadId(this.mApi.getState(), this.mCollection.archiveId);

      this.mApi.events.emit(
        "analytics-track-mixpanel-event",
        new CollectionsInstallationFailedEvent(
          nexusIds.collectionId,
          nexusIds.revisionId,
          nexusIds.numericGameId,
          "",
          error?.message,
        ),
      );

      // Complete tracking with failure
      this.completeInstallationTracking(false);

      return null;
    },
    1000,
  );

  constructor(api: IExtensionApi) {
    this.mApi = api;

    this.mInfoCache = new InfoCache(api);

    api.onAsync("will-install-mod", (gameId: string, archiveId: string, modId: string) => {
      const state: IState = api.store.getState();
      const download = state.persistent.downloads.files[archiveId];
      if (download !== undefined) {
        this.mInstallingMod = download.localPath;
        // mark the mod as installing on the session so the UI reflects the live phase
        // (the install/extraction phase is otherwise indistinguishable from "downloaded")
        const lookup = lookupFromDownload(download);
        const matchingRule = this.mDependentMods.find((rule) =>
          testModReference(lookup, rule.reference),
        );
        if (matchingRule !== undefined) {
          this.updateModTracking(matchingRule, "installing");
        }
      }
      return Bluebird.resolve();
    });

    api.events.on("did-install-mod", (gameId: string, archiveId: string, modId: string) => {
      const state: IState = api.store.getState();
      const mod = getSafe(state.persistent.mods, [gameId, modId], undefined);
      const downloads = state.persistent.downloads.files;
      // verify the mod installed is actually one required by this collection
      const dependent = this.mDependentMods.find((iter) => {
        const nameSet = new Set<string>();
        const fileIdSet = new Set<string>();
        fileIdSet.add(mod?.attributes?.fileId?.toString());
        nameSet.add(downloads[archiveId]?.localPath);
        const identifiers = {
          gameId,
          modId: mod?.attributes?.modId,
          fileId: mod?.attributes?.fileId,
          fileIds: Array.from(fileIdSet).filter((id) => id !== undefined) as string[],
          fileNames: Array.from(nameSet).filter((n) => n !== undefined) as string[],
        };
        return (
          testModReference(mod, iter.reference) || testRefByIdentifiers(identifiers, iter.reference)
        );
      });

      if (mod !== undefined && dependent !== undefined) {
        const isMarkedInstalled = this.mInstalledMods.find((m) => m.id === mod.id) !== undefined;
        if (isMarkedInstalled) {
          // Been here, done that. Update progress and return
          this.mProgressDebouncer.schedule();
          return;
        }
        if (dependent.type === "requires") {
          this.mInstalledMods.push(mod);
        }

        // Mark as installed in tracking
        this.markModInstalledInTracking(dependent, modId);

        if (
          this.mCollection?.installationPath !== undefined &&
          dependent.reference.description !== undefined
        ) {
          if (dependent.type === "requires") {
            this.mProgressDebouncer.schedule();
          }
          const installSpec = ruleInstallSpec(dependent);
          applyPatches(
            api,
            this.mCollection,
            gameId,
            dependent.reference.description,
            modId,
            installSpec.patches,
          );
          batchDispatch(api.store, [
            setFileOverride(gameId, modId, dependent.extra?.fileOverrides),
            setModAttribute(gameId, modId, "installerChoices", installSpec.installerChoices),
            setModAttribute(gameId, modId, "patches", installSpec.patches),
            setModAttribute(gameId, modId, "fileList", installSpec.fileList),
          ]);
        }
      }
      this.triggerUpdate();
    });

    api.events.on("did-finish-download", (downloadId: string, downloadState: string) => {
      // not checking whether the download is actually part of this collection because
      // that check may be more expensive than the ui update
      this.mProgressDebouncer.schedule();

      // Update mod status to 'downloaded' when download completes successfully
      if (downloadState === "finished") {
        const state = api.getState();
        const download = state.persistent.downloads.files[downloadId];
        if (download) {
          const lookup = lookupFromDownload(download);
          const matchingRule = this.mDependentMods.find((rule) => {
            return testModReference(lookup, rule.reference);
          });
          if (matchingRule) {
            this.updateModTracking(matchingRule, "downloaded");
          }
        }
      }
    });

    api.events.on(
      "free-user-skipped-download",
      (identifiers: {
        gameId: string;
        modId?: number;
        fileId?: number;
        fileNames?: string[];
        fileIds?: string[];
      }) => {
        const sanitize = (fileName: string) => fileName.toLowerCase().replace(/[^a-z]+/gi, "");
        const rule = this.mDependentMods.find((r) => {
          const condition = () => {
            // So this is shit, but we need to account for the fact that the fileId may never match
            //  due to incorrect update chains.
            if (r.reference.versionMatch != null && isFuzzyVersion(r.reference.versionMatch)) {
              if (
                identifiers.modId == null ||
                r.reference.repo?.modId !== identifiers.modId.toString()
              ) {
                return false;
              }
              const nameSet = new Set(identifiers.fileNames.map(sanitize));
              if (identifiers.fileNames) {
                if (!nameSet.has(sanitize(r.reference.logicalFileName))) {
                  return false;
                }
              }
              // If we made it this far, we have the correct modId and logicalFileName
              //  should be good enough...
              return true;
            }
          };
          return testRefByIdentifiers({ ...identifiers, condition } as any, r.reference);
        });
        if (rule) {
          this.markRuleIgnored(rule);
        } else {
          log("error", "could not find rule for skipped free user download", {
            identifiers,
          });
        }
      },
    );

    api.onStateChange(
      ["persistent", "downloads", "files"],
      (prev: { [id: string]: IDownload }, current: { [id: string]: IDownload }) => {
        if (this.mDependentMods.length === 0) return;

        const newIds = Object.keys(current).filter((id) => prev?.[id] === undefined);
        for (const dlId of newIds) {
          const download = current[dlId];
          if (!download) continue;

          const lookup = lookupFromDownload(download);
          const matchingRule = this.mDependentMods.find((rule) => {
            return testModReference(lookup, rule.reference);
          });

          const isBundled = matchingRule?.extra?.localPath != null;
          if (matchingRule && !isBundled) {
            this.updateModTracking(matchingRule, "downloading");
          }
        }
      },
    );

    api.events.on("did-import-downloads", (dlIds: string[]) => {
      // Update tracking for bundled mods that were just imported
      const state = api.getState();
      const downloads = state.persistent.downloads.files;

      dlIds.forEach((dlId) => {
        const download = downloads[dlId];
        if (download) {
          const lookup = lookupFromDownload(download);
          const matchingRule = this.mDependentMods.find((rule) => {
            return testModReference(lookup, rule.reference);
          });
          if (matchingRule) {
            this.updateModTracking(matchingRule, "downloaded");
          }
        }
      });
    });

    api.events.on("collection-mod-skipped", (reference: IModReference) => {
      // Update tracking when a mod download is skipped (for both free and premium users)
      const matchingRule = this.mDependentMods.find((rule) => {
        // Match by tag (most reliable) or other identifiers
        if (reference.tag && rule.reference.tag === reference.tag) {
          return true;
        }
        if (reference.fileMD5 && rule.reference.fileMD5 === reference.fileMD5) {
          return true;
        }
        if (
          reference.logicalFileName &&
          rule.reference.logicalFileName === reference.logicalFileName
        ) {
          return true;
        }
        return false;
      });
      if (matchingRule) {
        this.markRuleIgnored(matchingRule);
      }
    });

    api.events.on(
      "will-install-dependencies",
      (profileId: string, modId: string, recommendations: boolean, onCancel: () => void) => {
        const state = api.getState();
        const profile = this.profile || profileById(state, profileId);
        const gameId = this.mGameId || profile?.gameId;
        if (gameId === undefined) {
          // how?
          return;
        }
        const mods = state.persistent.mods[gameId];
        if (this.mCollection === undefined && mods[modId]?.type === MOD_TYPE && recommendations) {
          // When installing optional mods, it's possible for the mCollection
          //  property to be undefined - we need to ensure that the driver is
          //  aware that it's installing mods that are part of the collection
          //  in order for us to apply any collection mod rules to the mods themselves
          //  upon successful installation.
          const collection = mods[modId];
          this.mLastCollection = this.mCollection = collection;
          this.mStep = "installing";

          // Populate mDependentMods so that patches and file overrides can be
          // applied when the optional mods are installed.
          const required = (collection?.rules ?? []).filter((rule) =>
            ["requires", "recommends"].includes(rule.type),
          );
          this.mDependentMods = required.filter(
            (rule) =>
              findModByRef(rule.reference, mods, undefined, ruleInstallSpec(rule)) === undefined,
          );
        }

        const isCollectionMod = (rule) => findModByRef(rule.reference, mods)?.id === modId;

        if (
          this.mCollection !== undefined &&
          recommendations &&
          (this.mCollection.rules ?? []).find(isCollectionMod)
        ) {
          onCancel();
        }
      },
    );

    api.events.on(
      "did-install-dependencies",
      (gameId: string, modId: string, recommendations: boolean) => {
        this.onDidInstallDependencies(gameId, modId, recommendations);
      },
    );
  }

  public async prepare(func: () => Bluebird<void>) {
    this.mPrepare = this.mPrepare.then(func);
  }

  public async query(profile: IProfile, collection: IMod) {
    await this.mPrepare;
    this.mPrepare = Bluebird.resolve();

    if (collection?.archiveId === undefined) {
      return;
    }

    if (!this.mInstallDone && this.mCollection !== undefined) {
      this.mApi.sendNotification({
        type: "warning",
        message: "Already installing a collection",
      });
      return;
    }
    this.mProfile = profile;
    this.mLastCollection = this.mCollection = collection;
    this.mGameId = profile?.gameId ?? activeGameId(this.mApi.getState());
    this.mStep = "query";
    await this.initCollectionInfo();
    this.triggerUpdate();
  }

  public async start(profile: IProfile, collection: IMod) {
    await this.mPrepare;
    this.mPrepare = Bluebird.resolve();

    if (collection?.archiveId === undefined) {
      return;
    }

    if (!this.mInstallDone && this.mCollection !== undefined) {
      this.mApi.sendNotification({
        type: "warning",
        message: "Already installing a collection",
        displayMS: 5000,
      });
      log("warn", "already installing a collection");
      return;
    }

    this.mProfile = profile;
    this.mLastCollection = this.mCollection = collection;
    this.mGameId = profile?.gameId ?? activeGameId(this.mApi.getState());

    this.mTotalSize = calculateCollectionSize(this.getModsEx(profile, this.mGameId, collection));

    await this.startInstall();
    await this.initCollectionInfo();

    this.triggerUpdate();
  }

  public onUpdate(cb: UpdateCB) {
    this.mUpdateHandlers.push(cb);
  }

  public get profile() {
    return this.mProfile;
  }

  public set profile(val: IProfile) {
    this.mProfile = val;
    if (val !== undefined) {
      this.mGameId = val?.gameId;
    }
  }

  public get infoCache() {
    return this.mInfoCache;
  }

  public get step() {
    return this.mStep;
  }

  public get postprocessing(): boolean {
    return this.mPostprocessing;
  }

  public get installedMods(): IMod[] {
    return this.mInstalledMods;
  }

  public get numRequired(): number {
    return this.requiredMods.length;
  }

  public get installingMod(): string {
    return this.mInstallingMod;
  }

  public get collection(): IMod {
    return this.mCollection;
  }

  /**
   * return last collection that was installed. Only difference to "collection" is that this
   * does not get reset after the installation completes but please be aware that there is
   * no guarantee this collection is still installed
   */
  public get lastCollection(): IMod {
    return this.mLastCollection;
  }

  public get collectionId(): string {
    const state: IState = this.mApi.store.getState();
    const modInfo =
      this.mCollection !== undefined
        ? state.persistent.downloads.files[this.mCollection.archiveId]?.modInfo
        : undefined;
    const nexusInfo = modInfo?.nexus;

    return nexusInfo?.ids?.collectionId || modInfo?.ids?.collectionId;
  }

  public get collectionSlug(): string {
    const state: IState = this.mApi.store.getState();
    const modInfo =
      this.mCollection !== undefined
        ? state.persistent.downloads.files[this.mCollection.archiveId]?.modInfo
        : undefined;
    const nexusInfo = modInfo?.nexus;

    return nexusInfo?.ids?.collectionSlug || modInfo?.ids?.collectionSlug;
  }

  public get revisionNumber(): number {
    const state: IState = this.mApi.store.getState();
    const modInfo =
      this.mCollection !== undefined
        ? state.persistent.downloads.files[this.mCollection.archiveId]?.modInfo
        : undefined;
    const nexusInfo = modInfo?.nexus;

    return nexusInfo?.ids?.revisionNumber || modInfo?.ids?.revisionNumber;
  }

  public get revisionId(): number {
    const state: IState = this.mApi.store.getState();
    const modInfo =
      this.mCollection !== undefined
        ? state.persistent.downloads.files[this.mCollection.archiveId]?.modInfo
        : undefined;
    const nexusInfo = modInfo?.nexus;

    return nexusInfo?.ids?.revisionId || modInfo?.ids?.revisionId;
  }

  public get collectionInfo(): nexusApi.ICollection {
    return this.mCollectionInfo;
  }

  public get revisionInfo(): IRevisionEx {
    return this.mRevisionInfo;
  }

  public get installDone(): boolean {
    return this.mInstallDone;
  }

  public cancel() {
    this.onStop();

    this.triggerUpdate();
  }

  public installRecommended() {
    const recommendedRules = this.mCollection.rules.filter((r) => r.type === "recommends");
    this.mApi.emitAndAwait(
      "install-from-dependencies",
      this.mCollection.id,
      recommendedRules,
      true,
    );
    this.mStep = "recommendations";
    this.triggerUpdate();
  }

  public async continue() {
    if (this.canContinue() && this.mCollection?.archiveId !== undefined) {
      await this.initCollectionInfo();

      const steps = {
        query: this.startInstall,
        start: this.begin,
        disclaimer: this.closeDisclaimers,
        installing: this.finishInstalling,
        recommendations: this.finishInstalling,
        review: this.close,
      };
      const res = await steps[this.mStep]?.();
      if (res !== false) {
        this.triggerUpdate();
      }
    }
  }

  public canContinue() {
    if (this.mCollection === undefined) {
      return false;
    }
    if (this.mStep === "installing") {
      return this.mInstallDone;
    } else if (this.mStep === "disclaimer") {
      return this.mInstalledMods.length > 0 || this.mInstallDone;
    } else {
      return true;
    }
  }

  public canClose() {
    return ["start"].indexOf(this.mStep) !== -1;
  }

  public canHide() {
    return ["disclaimer", "installing"].indexOf(this.mStep) !== -1;
  }

  public enableTracking(enabled: boolean = true) {
    this.mTrackingEnabled = enabled;
  }

  public get isTrackingEnabled(): boolean {
    return this.mTrackingEnabled;
  }

  public get currentSessionId(): string | undefined {
    return this.mCurrentSessionId;
  }

  private async initCollectionInfo() {
    if (this.mCollection?.archiveId === undefined) {
      return;
    }
    const slug = this.collectionSlug;
    const state: IState = this.mApi.store.getState();
    const modInfo = state.persistent.downloads.files[this.mCollection.archiveId]?.modInfo;
    const nexusInfo = modInfo?.nexus;
    this.mCollectionInfo =
      nexusInfo?.collectionInfo ??
      (await this.mInfoCache.getCollectionInfo(slug)) ??
      // this last fallback is for the weird case where we have revision info cached but
      // not collection info and fetching is not possible because it's been deleted from the
      // site
      // Not sure if/why this would happen on live, it did occur during testing because the
      // stuff was getting deleted from the DB directly
      this.mRevisionInfo?.collection;
  }

  private async onDidInstallDependencies(gameId: string, modId: string, recommendations: boolean) {
    const mods = this.mApi.getState().persistent.mods[gameId];

    if (mods[modId]?.type === MOD_TYPE) {
      log("info", "did install dependencies", { gameId, modId });
    }

    if (this.mCollection !== undefined && modId === this.mCollection.id) {
      // update the stored collection because it might have been updated as part of the
      // dependency installation
      this.mLastCollection = this.mCollection = mods[modId];

      if (this.mCollection !== undefined) {
        if (!recommendations) {
          const isInstalled = (rule: any) => {
            const mod = findModByRef(rule.reference, mods);
            return mod != null && mod?.state === "installed";
          };
          const filter = (rule) =>
            rule.type === "requires" && rule["ignored"] !== true && isInstalled(rule) === false;

          const incomplete = (this.mCollection.rules ?? []).find(filter);
          if (incomplete === undefined) {
            await this.initCollectionInfo();
            this.mStep = "review";
          } else {
            this.mInstallDone = true;
            this.mInstallingMod = undefined;
          }
          this.mProgressDebouncer.clear();
          this.mApi.dismissNotification(INSTALLING_NOTIFICATION_ID + modId);
          this.triggerUpdate();
        } else {
          // We finished installing optional mods for the current collection - reset everything.
          const filter = (rule) =>
            ["requires", "recommends"].includes(rule.type) &&
            rule["ignored"] !== true &&
            findModByRef(rule.reference, mods) === undefined;

          const incomplete = (this.mCollection.rules ?? []).find(filter);

          this.mProgressDebouncer.clear();
          this.mApi.dismissNotification(INSTALLING_NOTIFICATION_ID + modId);

          if (incomplete === undefined) {
            // revisit review screen
            await this.initCollectionInfo();
            this.mStep = "review";
          } else {
            this.onStop();
          }
        }
        this.mApi.events.emit("trigger-test-run", "collections-changed");
      }
    }

    const stagingPath = installPathForGame(this.mApi.getState(), gameId);
    const mod = mods[modId];
    if (mod !== undefined && mod.type === MOD_TYPE) {
      try {
        const collectionInfo: ICollection = await readCollection(
          this.mApi,
          path.join(stagingPath, mod.installationPath, "collection.json"),
        );

        // Signal postprocessing and yield to the event loop so the review
        // dialog can render before the heavy deployment/parsing work begins.
        this.mPostprocessing = true;
        this.triggerUpdate();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        await postprocessCollection(this.mApi, gameId, mod, collectionInfo, mods);

        this.mPostprocessing = false;

        // Refresh again so that postprocessing changes are reflected in the UI.
        // (and have the finalization step cleared)
        this.triggerUpdate();

        /* COLLECTIONS COMPLETED ANALYTICS */

        const nexusIds = nexusIdsFromDownloadId(this.mApi.getState(), this.mCollection.archiveId);

        const duration_ms = Date.now() - this.mTimeStarted;

        this.mApi.events.emit(
          "analytics-track-mixpanel-event",
          new CollectionsInstallationCompletedEvent(
            nexusIds.collectionId,
            nexusIds.revisionId,
            nexusIds.numericGameId,
            this.installedMods.length,
            duration_ms,
          ),
        );

        // this.mApi.events.emit('analytics-track-event-with-payload', 'Collection Installation Completed', {
        //   collection_slug: this.collectionSlug,
        //   collection_revision_number: this.revisionNumber
        // });
      } catch (err) {
        this.mPostprocessing = false;
        log(
          "info",
          "Failed to apply mod rules from collection. This is normal if this is the " +
            "platform where the collection has been created.",
        );
        this.mDebounce.schedule(undefined, this.collectionSlug, this.revisionNumber, err);
      }
    }
  }

  private onStop() {
    this.mPostprocessing = false;
    if (this.mCollection !== undefined) {
      this.mApi.dismissNotification(INSTALLING_NOTIFICATION_ID + this.mCollection.id);

      // Flush pending tracking updates before cleanup so they aren't lost
      this.mModStatusDebouncer.runNow(() => undefined);
      // Cancel any pending progress notification — the notification is about
      // to be dismissed anyway and we don't want it to fire after cleanup.
      this.mProgressDebouncer.clear();

      // Ensure InstallManager cleans up its internal state (pending installs,
      // active installs, phase state) for this collection. This is idempotent —
      // if pauseCollection already emitted this event, the handler is a no-op.
      this.mApi
        .emitAndAwait("cancel-dependency-install", this.mCollection.id)
        .catch(() => undefined);
    }

    // Complete the installation tracking as cancelled/failed
    this.completeInstallationTracking(false);

    this.mCollection = undefined;
    this.mProfile = undefined;
    this.mGameId = undefined;
    this.mInstalledMods = [];
    this.mDependentMods = [];
    this.mStep = "prepare";
    this.mOnStop?.();
  }

  private getModsEx(
    profile: IProfile,
    gameId: string,
    collection: IMod,
  ): { [id: string]: IMod & { collectionRule: IModRule } } {
    if (profile === undefined) {
      profile = this.mProfile;
    }
    if (profile === undefined) {
      return {};
    }

    const mods = this.mApi.getState().persistent.mods[gameId];

    if (mods === undefined) {
      log("error", "no mods for game", { gameId });
      return {};
    }

    return (collection.rules ?? []).reduce((prev, rule) => {
      if (!["requires", "recommends"].includes(rule.type)) {
        return prev;
      }

      const mod = findModByRef(rule.reference, mods);
      prev[modRuleId(rule)] = { ...mod, collectionRule: rule };

      return prev;
    }, {});
  }

  private startInstall = async () => {
    // suppress plugins-changed event to avoid constantly running expensive callbacks
    // until onStop gets called
    this.mApi.ext.withSuppressedTests?.(
      ["plugins-changed", "settings-changed", "mod-activated", "mod-installed"],
      () =>
        new Bluebird((resolve) => {
          this.mOnStop = () => {
            resolve(undefined);
            this.mOnStop = undefined;
          };
        }),
    );

    return this.startImpl();
  };

  private startImpl = async () => {
    if (this.mCollection?.archiveId === undefined || this.mProfile === undefined) {
      return false;
    }

    this.mInstalledMods = [];
    this.mInstallingMod = undefined;
    this.mInstallDone = false;
    this.mStep = "start";

    const collection = this.mCollection;
    const profile = this.mProfile;
    const gameId = this.mGameId;

    const state: IState = this.mApi.store.getState();
    const mods = state.persistent.mods[gameId] ?? {};
    const modInfo = state.persistent.downloads.files[collection.archiveId]?.modInfo;
    const nexusInfo = modInfo?.nexus;

    const slug = this.collectionSlug;
    const revisionId = this.revisionId;

    if (revisionId !== undefined) {
      try {
        this.mRevisionInfo = Array.isArray(nexusInfo?.revisionInfo?.modFiles)
          ? nexusInfo.revisionInfo
          : await this.mInfoCache.getRevisionInfo(revisionId, slug, this.revisionNumber);
      } catch (err) {
        log("error", "failed to get remote info for revision", {
          revisionId,
          slug,
          revisionNumber: this.revisionNumber,
          error: getErrorMessageOrDefault(err),
        });
      }
    }

    const { userInfo } = state.persistent["nexus"] ?? {};
    // don't request a vote on own collection
    if (this.mRevisionInfo?.collection?.user?.memberId !== userInfo?.userId) {
      this.mApi.store.dispatch(setPendingVote(revisionId, slug, this.revisionNumber, Date.now()));
    }

    const gameMode = gameId;
    const currentgame = getGame(gameMode);
    const discovery = discoveryByGame(state, gameMode);
    const gameVersion = await currentgame.getInstalledVersion(discovery);
    const gvMatch = (gv) => gv.reference === gameVersion;
    const revGameVersions = this.mRevisionInfo?.gameVersions ?? [];
    if ((revGameVersions.length ?? 0 !== 0) && revGameVersions.find(gvMatch) === undefined) {
      const choice = await this.mApi.showDialog(
        "question",
        "Game version mismatch",
        {
          bbcode:
            "The version of the game you have installed is different to the one the curator used when creating this collection." +
            "[br][/br][br][/br]" +
            "Your game version: [style=dialog-success-text]{{actual}}[/style]" +
            "[br][/br]" +
            "Recommended game version: [style=dialog-danger-text]{{intended}}[/style]" +
            "[br][/br][br][/br]" +
            "If you choose to continue, some or all of the mods included in the collection may not work properly for you. This will " +
            "require manual troubleshooting to correct. For users who are not familiar with modding, we do not recommend continuing with installation." +
            "[br][/br][br][/br]" +
            "You can also check the description, comments and bug reports on the Collection page to see if others have been successful " +
            "while playing with the game version you have installed or to request advice from the curator.",
          parameters: {
            actual: gameVersion,
            intended: revGameVersions.map((gv) => gv.reference).join(" or "),
          },
        },
        [{ label: "Cancel" }, { label: "Continue" }],
      );
      if (choice.action === "Cancel") {
        this.mInstallDone = true;
        return false;
      }
    }

    this.mApi.events.emit("will-install-collection", gameId, collection.id);

    this.mApi.events.emit("view-collection", collection.id);

    this.updateProgress(profile, gameId, collection);

    this.augmentRules(gameId, collection);

    this.mApi.dismissNotification(getUnfulfilledNotificationId(collection.id));
    this.mApi.store.dispatch(setModEnabled(profile.id, collection.id, true));

    const required = (collection?.rules ?? []).filter((rule) =>
      ["requires", "recommends"].includes(rule.type),
    );
    const dependencies: IModRule[] = required.reduce((accum, rule) => {
      const mod = findModByRef(rule.reference, mods, undefined, ruleInstallSpec(rule));
      if (mod === undefined) {
        accum.push(rule);
      }
      return accum;
    }, []);
    this.mDependentMods = dependencies;
    // log('debug', 'dependent mods', JSON.stringify(dependencies));

    /* COLLECTIONS START ANALYTICS */

    this.mTimeStarted = Date.now();

    // this.mApi.events.emit('analytics-track-event-with-payload', 'Collection Installation Started', {
    //   collection_slug: this.collectionSlug,
    //   collection_revision_number: this.revisionNumber
    // });

    const nexusIds = nexusIdsFromDownloadId(this.mApi.getState(), collection.archiveId);
    if (nexusIds?.collectionId != null) {
      this.mApi.events.emit(
        "analytics-track-mixpanel-event",
        new CollectionsInstallationStartedEvent(
          nexusIds.collectionId,
          nexusIds.revisionId,
          nexusIds.numericGameId,
          this.numRequired,
        ),
      );
    }

    if (this.requiredMods.length === 0) {
      this.mInstallDone = false;
    }

    if (this.mTrackingEnabled) {
      const collectionId = collection.id;
      const optional = required.filter((r) => r.type === "recommends");
      const totalOptional = optional.length;
      const totalRequired = required.length - optional.length;

      // Generate unique session ID
      this.mCurrentSessionId = generateCollectionSessionId(collectionId, profile.id);

      const downloads = state.persistent.downloads.files;

      // the session's per-rule mod info, keyed by rule id
      const sessionModInfo: Record<string, ICollectionModInstallInfo> = Object.fromEntries(
        required.map((rule) => {
          const ruleId = modRuleId(rule);
          const mod = findModByRef(rule.reference, mods, undefined, ruleInstallSpec(rule));
          const dlId = findDownloadByRef(rule.reference, downloads);
          const status = reconstructModStatus(
            rule,
            mod,
            dlId != null ? downloads[dlId] : undefined,
          );

          return [
            ruleId,
            {
              rule,
              status,
              type: rule.type as "requires" | "recommends",
              phase: rule.extra?.phase ?? 0,
            },
          ];
        }),
      );

      // Dispatch start session action (omitting computed properties)
      this.mApi.store.dispatch(
        installActions.startInstallSession({
          sessionId: this.mCurrentSessionId,
          collectionId,
          profileId: profile.id,
          gameId: this.mGameId,
          mods: sessionModInfo,
          totalRequired,
          totalOptional,
        }),
      );
    }

    log("info", "starting install of collection", {
      totalMods: required.length,
      missing: this.requiredMods.length,
    });
  };

  private matchRepo(rule: IModRule, ref: nexusApi.IModFile) {
    if (ref === null) {
      return false;
    }

    const modId = rule.reference.repo?.modId;
    const fileId = rule.reference.repo?.fileId;

    if (modId === undefined || fileId === undefined || !ref.modId || !ref.fileId) {
      return false;
    }

    return modId.toString() === ref.modId.toString() && fileId.toString() === ref.fileId.toString();
  }

  private augmentRules(gameId: string, collection: IMod) {
    batchDispatch(
      this.mApi.store,
      (collection.rules ?? [])
        .map((rule) => {
          if (rule.reference.repo === undefined) {
            return undefined;
          }
          const modFiles = this.mRevisionInfo?.modFiles;
          if (modFiles == null) {
            return undefined;
          }
          if (!Array.isArray(modFiles)) {
            // what?
            log("error", "IRevision.modFiles is not an array", {
              unexpectedType: typeof modFiles,
              value: JSON.stringify(modFiles)?.slice(0, 200),
            });
            return undefined;
          }
          const revMod = modFiles.find((iter) => this.matchRepo(rule, iter.file));
          if (revMod?.file !== undefined) {
            const newRule = setSafe(rule, ["extra", "fileName"], revMod.file.uri);
            return addModRule(gameId, collection.id, newRule);
          }
        })
        .filter((rule) => rule !== undefined),
    );
  }

  private begin = () => {
    if (this.mCollection === undefined || this.mProfile?.id === undefined) {
      return;
    }

    this.mApi.events.emit(
      "install-dependencies",
      this.mProfile.id,
      this.mGameId,
      [this.mCollection.id],
      true,
    );
    // skipping disclaimer for now
    this.mStep = "installing";
  };

  private closeDisclaimers = () => {
    this.mStep = "installing";
  };

  private finishInstalling = () => {
    this.mStep = "review";
  };

  private close = () => {
    if (this.mGameId !== undefined && this.mCollection !== undefined) {
      this.mApi.events.emit("did-install-collection", this.mGameId, this.mCollection.id);
      this.mProgressDebouncer.clear();
      this.mApi.dismissNotification(INSTALLING_NOTIFICATION_ID + this.mCollection.id);
    }

    this.completeInstallationTracking(true);
    this.mCollection = undefined;
    this.mDependentMods = [];
    this.mInstallDone = true;
    this.triggerUpdate();
  };

  private triggerUpdate() {
    this.mUpdateHandlers.forEach((cb) => {
      cb();
    });
  }

  private installProgress(profile: IProfile, gameId: string, collection: IMod): number {
    const mods = this.getModsEx(profile, gameId, collection);

    const downloads = this.mApi.getState().persistent.downloads.files;

    const downloadProgress = Object.values(mods).reduce((prev, mod) => {
      let size = 0;

      if (mod.state === "downloaded") {
        // Download complete - use full file size
        size += mod.attributes?.fileSize || 0;
      } else if (mod.state === "downloading" || mod.state == null) {
        // Download in progress - use received bytes or total size
        const download = downloads[mod.archiveId];
        size += download?.received || download?.size || 0;
      } else {
        // Not started or installed
        size += mod.attributes?.fileSize || 0;
      }
      return prev + size;
    }, 0);

    const installedMods = Object.values(mods).filter((mod) => mod.state === "installed");
    const totalMods = Object.values(mods).filter(isRelevant);

    const dlPerc = downloadProgress / this.mTotalSize;
    const instPerc = installedMods.length / totalMods.length;

    return (dlPerc + instPerc) * 50.0;
  }

  private updateProgress(profile: IProfile, gameId: string, collection: IMod) {
    if (collection === undefined) {
      return;
    }

    if (this.mTotalSize === undefined) {
      this.mTotalSize = calculateCollectionSize(this.getModsEx(profile, gameId, collection));
    }

    this.mApi.sendNotification({
      id: INSTALLING_NOTIFICATION_ID + collection.id,
      type: "activity",
      title: "Installing Collection",
      message: renderModName(collection),
      progress: this.installProgress(profile, gameId, collection),
      actions: [
        {
          title: "Show",
          action: () => {
            this.mApi.events.emit("view-collection", collection.id);
          },
        },
      ],
    });
  }
}

export default InstallDriver;
