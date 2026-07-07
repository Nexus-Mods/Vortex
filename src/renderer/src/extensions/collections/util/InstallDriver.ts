import * as path from "path";

import type * as nexusApi from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";
import Bluebird from "bluebird";

import * as installActions from "../../../actions/collectionInstallTracking";
import { log } from "../../../logging";
import type { ICollectionModInstallInfo } from "../../../types/collections/ICollectionInstallSession";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import {
  generateCollectionSessionId,
  isTerminalMemberStatus,
} from "../../../util/collectionInstallSession";
import {
  getCollectionActiveSession,
  getCollectionInstallProgress,
} from "../../../util/collectionInstallSessionSelectors";
import {
  reconstructSessionMods,
  resyncCollectionSessionRules,
} from "../../../util/collectionSessionReconstruct";
import { markCollectionMemberSkipped } from "../../../util/collectionSkip";
import Debouncer from "../../../util/Debouncer";
import { getSafe, setSafe } from "../../../util/storeHelper";
import { batchDispatch } from "../../../util/util";
import {
  CollectionsInstallationCompletedEvent,
  CollectionsInstallationFailedEvent,
  CollectionsInstallationStartedEvent,
} from "../../analytics/mixpanel/MixpanelEvents";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { getGame } from "../../gamemode_management/util/getGame";
import { addModRule, setFileOverride, setModAttribute } from "../../mod_management/actions/mods";
import { setPendingPluginSort } from "../../mod_management/actions/transactions";
import { installPathForGame } from "../../mod_management/selectors";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { findModByRef } from "../../mod_management/util/findModByRef";
import renderModName from "../../mod_management/util/modName";
import testModReference, {
  isDependencyRule,
  isOptionalRule,
  isRequiredRule,
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
import type { ICollection } from "../types/ICollection";
import type { IRevisionEx } from "../types/IRevisionEx";
import { applyPatches } from "./binaryPatching";
import { isGamebryoGame } from "./gameSupport";
import InfoCache from "./InfoCache";
import { readCollection } from "./readCollection";
import { getUnfulfilledNotificationId } from "./util";

export type Step =
  | "prepare"
  | "changelog"
  | "query"
  | "start"
  | "disclaimer"
  | "installing"
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
  // referenceTag -> member rule, kept in sync with mDependentMods (see setDependentMods). Lets the
  // did-install-mod handler resolve an installed mod to its rule in O(1) by its stamped
  // referenceTag instead of scanning every member, which is what made attribution O(n^2) and froze
  // the UI on 2000-4000 mod collections.
  private mDependentByTag: Map<string, IModRule> = new Map();
  private mInstallingMod: string;
  private mInstallDone: boolean = false;
  private mCollectionInfo: nexusApi.ICollection;
  private mRevisionInfo: nexusApi.IRevision;
  private mInfoCache: InfoCache;
  private mOnStop: () => void;
  private mPrepare: Bluebird<void> = Bluebird.resolve();
  private mTimeStarted: number;
  private mPostprocessing: boolean = false;

  // Throttle the progress notification to avoid flooding Redux/UI on every single mod
  // event. (Session status writes are dispatched directly now - InstallManager is the
  // single lifecycle writer, so the driver's remaining writes are low-frequency and there
  // is no dispatch storm to batch.) reset=false keeps it from starving,
  // triggerImmediately=true shows instant feedback on the first event.
  private mProgressDebouncer: Debouncer = new Debouncer(
    () => {
      if (this.mProfile && this.mGameId && this.mCollection) {
        this.updateProgress(this.mCollection);
      }
      return Bluebird.resolve();
    },
    1000,
    false,
    true,
  );

  // Collection installation tracking
  private mCurrentSessionId: string;
  private get requiredMods() {
    return this.mDependentMods.filter(isRequiredRule);
  }
  private get recommendedMods() {
    return this.mDependentMods.filter(isOptionalRule);
  }

  // single point that assigns the member rules, so the referenceTag index can never drift from
  // mDependentMods. First rule wins on a duplicate tag.
  private setDependentMods(rules: IModRule[]) {
    this.mDependentMods = rules;
    this.mDependentByTag = new Map();
    for (const rule of rules) {
      const tag = rule.reference.tag;
      if (tag !== undefined && !this.mDependentByTag.has(tag)) {
        this.mDependentByTag.set(tag, rule);
      }
    }
  }

  private completeInstallationTracking(success: boolean) {
    if (!this.mCurrentSessionId) {
      return;
    }

    this.mApi.store.dispatch(installActions.finishInstallSession(this.mCurrentSessionId, success));
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

    api.onAsync("will-install-mod", (_gameId: string, archiveId: string, _modId: string) => {
      const state: IState = api.store.getState();
      const download = state.persistent.downloads.files[archiveId];
      if (download !== undefined) {
        this.mInstallingMod = download.localPath;
        // the "installing" session status is now written by InstallManager directly
        // (the in-process write path), so the driver no longer translates this event
      }
      return Bluebird.resolve();
    });

    api.events.on("did-install-mod", (gameId: string, archiveId: string, modId: string) => {
      const state: IState = api.store.getState();
      const mod = getSafe(state.persistent.mods, [gameId, modId], undefined);
      const downloads = state.persistent.downloads.files;

      // verify the mod installed is actually one required by this collection. Fast path: an
      // installed collection member is stamped with its rule's referenceTag, and testModReference
      // treats an identical tag as authoritative, so a tag hit is a definitive O(1) match - this
      // is what keeps attribution from being O(members) per event (the 2000-4000 mod freeze).
      const taggedDependent =
        mod?.attributes?.referenceTag !== undefined
          ? this.mDependentByTag.get(mod.attributes.referenceTag)
          : undefined;

      // fallback for a mod with no (matching) referenceTag: match by reference / identifiers. The
      // identifiers are independent of the rule, so build them once rather than per member.
      let dependent = taggedDependent;
      if (dependent === undefined) {
        const fileIdSet = new Set<string>();
        const nameSet = new Set<string>();
        fileIdSet.add(mod?.attributes?.fileId?.toString());
        nameSet.add(downloads[archiveId]?.localPath);
        const identifiers = {
          gameId,
          modId: mod?.attributes?.modId,
          fileId: mod?.attributes?.fileId,
          fileIds: Array.from(fileIdSet).filter((id) => id !== undefined),
          fileNames: Array.from(nameSet).filter((n) => n !== undefined),
        };
        dependent = this.mDependentMods.find(
          (iter) =>
            testModReference(mod, iter.reference) ||
            testRefByIdentifiers(identifiers, iter.reference),
        );
      }

      if (mod !== undefined && dependent !== undefined) {
        const isMarkedInstalled = this.mInstalledMods.find((m) => m.id === mod.id) !== undefined;
        if (isMarkedInstalled) {
          // Been here, done that. Update progress and return
          this.mProgressDebouncer.schedule();
          return;
        }
        if (isRequiredRule(dependent)) {
          this.mInstalledMods.push(mod);
        }

        // the "installed" session status is now written by InstallManager directly
        // (the in-process write path); the driver keeps the patch/attribute side effects

        const installSpec = ruleInstallSpec(dependent);

        // Stamp the install spec (installerChoices/patches/fileList) onto the installed mod for
        // every member, including those with no reference.description, so it can be re-matched to
        // its rule on a later pass: reconstructSessionMods / findModByRef require a candidate to
        // also match the spec (modMatchesInstallSpec), so a member whose spec was never stamped is
        // judged "not installed" and gets re-pulled. (applyPatches below still needs the
        // description, which it uses as the mod label.) The stamping is tag-scheme agnostic, so it
        // keeps the hundreds of thousands of existing (random-tag) collections re-attributable too,
        // not just new deterministic ones.
        batchDispatch(api.store, [
          setFileOverride(gameId, modId, dependent.extra?.fileOverrides),
          setModAttribute(gameId, modId, "installerChoices", installSpec.installerChoices),
          setModAttribute(gameId, modId, "patches", installSpec.patches),
          setModAttribute(gameId, modId, "fileList", installSpec.fileList),
        ]);

        if (dependent.type === "requires") {
          this.mProgressDebouncer.schedule();
        }

        // applyPatches writes the binary patches into the collection's staging path and uses the
        // member's description as the mod label, so it (and only it) still needs both present.
        if (
          this.mCollection?.installationPath !== undefined &&
          dependent.reference.description !== undefined
        ) {
          applyPatches(
            api,
            this.mCollection,
            gameId,
            dependent.reference.description,
            modId,
            installSpec.patches,
          );
        }
      }
      this.triggerUpdate();
    });

    api.events.on("did-finish-download", () => {
      // progress UI only - the "downloaded" session status is written by InstallManager.
      // Not gated on collection membership: the check would cost more than the UI refresh.
      this.mProgressDebouncer.schedule();
    });

    // "downloading" (new downloads) and "downloaded" (imported/bundled downloads) are
    // now written by InstallManager, the single lifecycle writer for the session.

    // A skipped collection member (premium/automatic via InstallManager, or a free user via
    // nexus_integration) is now marked ignored at the skip site via markCollectionMemberSkipped;
    // the driver no longer listens for `collection-mod-skipped` / `free-user-skipped-download`.

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
          const required = (collection?.rules ?? []).filter((rule) => isDependencyRule(rule));
          this.setDependentMods(
            required.filter(
              (rule) =>
                findModByRef(rule.reference, mods, undefined, ruleInstallSpec(rule)) === undefined,
            ),
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

    await this.startInstall();
    await this.initCollectionInfo();

    this.triggerUpdate();
  }

  // returns a disposer that unregisters the handler. Callers (React components) MUST call it on
  // unmount: without it the handler list grows on every mount and triggerUpdate later fires the
  // stale closure, calling setState/forceUpdate on an unmounted component.
  public onUpdate(cb: UpdateCB): () => void {
    this.mUpdateHandlers.push(cb);
    return () => {
      const idx = this.mUpdateHandlers.indexOf(cb);
      if (idx !== -1) {
        this.mUpdateHandlers.splice(idx, 1);
      }
    };
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
    if (this.mCollection === undefined || this.mProfile?.id === undefined) {
      return;
    }
    const gameId = this.mGameId;
    const collectionId = this.mCollection.id;
    const recommendedRules = (this.mCollection.rules ?? []).filter((r) => r.type === "recommends");

    // Optionals default to skipped (ignored). Selecting them all means clearing the skip: the
    // dependency gather (filterDependencyRules) drops ignored rules, so without this the pass would
    // install nothing. Clear only those not already selected (ignored===false wins), persist the
    // flag, and resync so the session counts them toward completion.
    const toSelect = recommendedRules
      .filter((rule) => rule.ignored !== false)
      .map((rule) => ({ ...rule, ignored: false }));
    if (toSelect.length > 0) {
      batchDispatch(
        this.mApi.store,
        toSelect.map((rule) => addModRule(gameId, collectionId, rule)),
      );
      resyncCollectionSessionRules(this.mApi, toSelect);
    }

    // Re-run the normal collection dependency install (the same event begin() uses). The
    // already-installed required members are skipped by the gather; the now-selected optionals
    // install at OPTIONAL_PHASE through the normal phase engine and progress UI - no separate
    // recommendations pass. Completion returns here via did-install-dependencies -> review.
    this.mApi.events.emit("install-dependencies", this.mProfile.id, gameId, [collectionId], true);
    this.mStep = "installing";
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

  /**
   * Whether the active collection has nothing left to install: every required member (and, on the
   * recommendations pass, every recommended member too) has reached a terminal status - installed,
   * failed, or ignored (see isTerminalMemberStatus). Optional members default to skipped (ignored)
   * at session start, so they are terminal and do not block completion until the user selects one
   * (ignored:false), which returns it to a non-terminal status that blocks the recommendations pass
   * exactly like a required member. This is the completion DECISION, deliberately separate from the
   * postprocessing side-effect (finalizeInstalledCollection) so it can be unit-tested without the
   * staging-path / fs infrastructure.
   */
  public isInstallComplete(recommendations: boolean): boolean {
    if (this.mCollection === undefined || this.mGameId === undefined) {
      return false;
    }
    const session = getCollectionActiveSession(this.mApi.getState());
    if (session === undefined || session.collectionId !== this.mCollection.id) {
      // no active session for this collection - nothing we can assert as complete
      return false;
    }
    // The collection session is the single source of truth: it carries a terminal status per
    // member rule (written by the single-writer install path), so completion is an O(members)
    // scan. The required pass needs every required member terminal; the recommendations pass
    // additionally needs every recommended member terminal.
    const types: Array<ICollectionModInstallInfo["type"]> = recommendations
      ? ["requires", "recommends"]
      : ["requires"];
    return Object.values(session.mods)
      .filter((mod) => types.includes(mod.type))
      .every((mod) => isTerminalMemberStatus(mod.status));
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
          if (this.isInstallComplete(false)) {
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
          this.mProgressDebouncer.clear();
          this.mApi.dismissNotification(INSTALLING_NOTIFICATION_ID + modId);

          if (this.isInstallComplete(true)) {
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

    await this.finalizeInstalledCollection(gameId, modId, mods);
  }

  /**
   * Postprocessing side-effect after a dependency-install round: read the collection.json from
   * the staging folder and apply its mod rules, then emit completion analytics. Kept separate
   * from the completion DECISION (isInstallComplete) so the decision needs no fs/staging-path
   * infrastructure. Errors here are expected on the platform where the collection was authored,
   * so they are swallowed (with a failure-analytics debounce). The staging-path lookup is inside
   * the try so a path-resolution failure follows the same swallow path.
   */
  private async finalizeInstalledCollection(
    gameId: string,
    modId: string,
    mods: Record<string, IMod>,
  ) {
    const mod = mods[modId];
    if (mod === undefined || mod.type !== MOD_TYPE) {
      return;
    }
    try {
      const stagingPath = installPathForGame(this.mApi.getState(), gameId);
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

  private onStop() {
    this.mPostprocessing = false;
    if (this.mCollection !== undefined) {
      this.mApi.dismissNotification(INSTALLING_NOTIFICATION_ID + this.mCollection.id);

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
    this.setDependentMods([]);
    this.mStep = "prepare";
    this.mOnStop?.();
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

    // Durable "this profile still needs its plugins sorted/enabled" marker, set as soon as the
    // install begins so an interruption at ANY point (crash, quit mid-install) leaves a record.
    // Load order and plugin-enable state are per-profile. The marker drains on the next activation
    // of this profile (deploy then sort) and is cleared only when a plugin sort actually succeeds.
    // Only plugin-managed (gamebryo) games sort plugins, and only gamebryo clears the marker, so
    // restrict it to those games or non-gamebryo games would accumulate entries nothing clears.
    if (profile?.id !== undefined && isGamebryoGame(gameId)) {
      // Date.now() rather than Temporal: the stored value is a JSON-serialized epoch-ms number and
      // both produce exactly that. Temporal is only available on the Electron renderer, not under
      // the vitest (Node) test runner, so using it here would throw in tests for no functional gain.
      this.mApi.store.dispatch(setPendingPluginSort(profile.id, collection.id, Date.now()));
    }

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

    this.updateProgress(collection);

    this.augmentRules(gameId, collection);

    this.mApi.dismissNotification(getUnfulfilledNotificationId(collection.id));
    this.mApi.store.dispatch(setModEnabled(profile.id, collection.id, true));

    const required = (collection?.rules ?? []).filter((rule) => isDependencyRule(rule));
    const dependencies: IModRule[] = required.reduce((accum, rule) => {
      const mod = findModByRef(rule.reference, mods, undefined, ruleInstallSpec(rule));
      if (mod === undefined) {
        accum.push(rule);
      }
      return accum;
    }, []);
    this.setDependentMods(dependencies);
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

    const collectionId = collection.id;
    const optional = required.filter((r) => r.type === "recommends");
    const totalOptional = optional.length;
    const totalRequired = required.length - optional.length;

    // Generate unique session ID
    this.mCurrentSessionId = generateCollectionSessionId(collectionId, profile.id);

    const downloads = state.persistent.downloads.files;

    // the session's per-rule mod info, keyed by rule id, reconstructed from reality
    const sessionModInfo = reconstructSessionMods({ rules: required, mods, downloads });

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

    // Default optional members to skipped so they don't block completion. Only optionals with no
    // explicit ignored choice are defaulted - a defined ignored (a prior skip or select) wins, so
    // decisions survive re-installs/updates. Reuses the shared skip entry point (writes the durable
    // rule flag + session status) now that the session exists.
    for (const rule of optional) {
      if (rule.ignored === undefined) {
        markCollectionMemberSkipped(this.mApi, { reference: rule.reference });
      }
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
    this.setDependentMods([]);
    this.mInstallDone = true;
    this.triggerUpdate();
  };

  private triggerUpdate() {
    this.mUpdateHandlers.forEach((cb) => {
      cb();
    });
  }

  private installProgress(collection: IMod): number {
    // Read progress from the session SSOT instead of re-deriving it by scanning every mod
    // against every rule (the old getModsEx was O(rules x mods) on each tick). The session
    // carries O(1) download/install counters per member, kept current by the single-writer
    // install path; combinedProgress is the count-based download/install average (0-100).
    const state = this.mApi.getState();
    const session = getCollectionActiveSession(state);
    if (session === undefined || session.collectionId !== collection.id) {
      return 0;
    }
    const progress = getCollectionInstallProgress(state);
    if (progress === null) {
      return 0;
    }
    return progress.combinedProgress;
  }

  private updateProgress(collection: IMod) {
    if (collection === undefined) {
      return;
    }

    this.mApi.sendNotification({
      id: INSTALLING_NOTIFICATION_ID + collection.id,
      type: "activity",
      title: "Installing Collection",
      message: renderModName(collection),
      progress: this.installProgress(collection),
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
