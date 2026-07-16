import type { ExtensionInstallSource } from "./extensionInstallAnalytics";

/**
 * Interface for all Mixpanel events
 */
export interface MixpanelEvent {
  readonly eventName: string;
  readonly properties: Record<string, any>;
}

/**
 * Maps Node.js process.platform values to Mixpanel's expected OS format
 * @param platform - Node.js platform string (win32, darwin, linux, etc.)
 * @returns Mixpanel-compatible OS name (Windows, Mac OS X, Linux, etc.)
 */
export function mapPlatformToMixpanel(platform: string): string {
  switch (platform) {
    case "win32":
      return "Windows";
    case "darwin":
      return "Mac OS X";
    case "linux":
      return "Linux";
    default:
      return platform;
  }
}

/**
 * APP EVENTS
 */

/**
 * App launched event - sent when Vortex starts up
 * @param os Operating system (Node.js platform string: win32, darwin, linux)
 * @param os_version Operating system version (e.g., "10.0.22000" for Windows 11)
 * @param architecture CPU architecture (e.g., "x64", "arm64")
 */
export class AppLaunchedEvent implements MixpanelEvent {
  readonly eventName = "app_launched";
  readonly properties: Record<string, any>;

  constructor(os: string, os_version?: string, architecture?: string) {
    this.properties = {
      $os: mapPlatformToMixpanel(os), // Override auto-detected OS for accuracy
      $os_version: os_version, // Not auto-tracked by mixpanel-browser
      architecture, // Custom property for CPU architecture
    };
  }
}

/**
 * DNU - NEEDS TO BE FIRED BEFORE ANALYTICS ARE INITIALIZED
 * Event sent when the application is updated.
 * @param from_version Previous version
 * @param to_version New version
 * @param os Operating system (Node.js platform string: win32, darwin, linux)
 */
export class AppUpdatedEvent implements MixpanelEvent {
  readonly eventName = "app_updated";
  readonly properties: Record<string, any>;
  constructor(from_version: string, to_version: string, os: string) {
    this.properties = {
      from_version,
      to_version,
      $os: mapPlatformToMixpanel(os),
    };
  }
}

/**
 * Event sent when an upsell prompt is clicked in the application.
 */
export class AppUpsellClickedEvent implements MixpanelEvent {
  readonly eventName = "app_upsell_clicked";
  readonly properties: Record<string, any> = {};
  constructor() {}
}

/** Fields on the app_game_manage event. */
export interface GameManagedProps {
  game_id: number | null;
  extension_version: string;
}

/**
 * Sent the first time a game is managed, when its first profile is created.
 * `extension_version` is the version of the game's support extension.
 */
export class AppGameManagedEvent implements MixpanelEvent {
  readonly eventName = "app_game_manage";
  readonly properties: Record<string, unknown>;
  constructor(props: GameManagedProps) {
    this.properties = { ...props };
  }
}

/** Sent when a game is unmanaged (its profiles and mods are removed). */
export class AppGameUnmanagedEvent implements MixpanelEvent {
  readonly eventName = "app_game_unmanage";
  readonly properties: Record<string, unknown>;
  constructor(props: { game_id: number | null }) {
    this.properties = { ...props };
  }
}

/** How a game/tool launch was started, on the app_game_launched event. */
export type GameLaunchMethod = "direct_exe" | "store" | "script_extender" | "tool";

/**
 * Sent when the user launches the game or a tool from Vortex. `launch_session_id` pairs it with
 * the matching app_game_exited so launch and exit can be joined (and a duration derived).
 */
export interface GameLaunchedProps {
  game_id: number | null;
  launch_method: GameLaunchMethod;
  enabled_mod_count: number;
  launch_session_id: string;
}

export class AppGameLaunchedEvent implements MixpanelEvent {
  readonly eventName = "app_game_launched";
  readonly properties: Record<string, unknown>;
  constructor(props: GameLaunchedProps) {
    this.properties = { ...props };
  }
}

/** Fields on the app_game_exited event. */
export interface GameExitedProps {
  game_id: number | null;
  launch_method: GameLaunchMethod;
  enabled_mod_count: number;
  launch_session_id: string;
  duration_ms: number;
  // Process exit code, when Vortex launched the process itself; null for store launches.
  exit_code: number | null;
}

/**
 * Sent when a launched game/tool process exits. `duration_ms` is the time since its launch;
 * `launch_method`, `enabled_mod_count` and `launch_session_id` match the app_game_launched it
 * pairs with (captured at launch, so they reflect state at launch time).
 */
export class AppGameExitedEvent implements MixpanelEvent {
  readonly eventName = "app_game_exited";
  readonly properties: Record<string, unknown>;
  constructor(props: GameExitedProps) {
    this.properties = { ...props };
  }
}

/**
 * COLLECTION EVENTS
 */

/* COLLECTION DRAFTING AND UPLOADING */

/**
 * Event sent when a collection draft is created in Vortex.
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 * @param creation_method How the collection was created
 */
export class CollectionsDraftedEvent implements MixpanelEvent {
  readonly eventName = "collection_drafted";
  readonly properties: Record<string, any>;

  constructor(
    collection_name: string,
    game_name: string,
    creation_method: "from_profile" | "quick_collection" | "empty",
  ) {
    this.properties = {
      collection_name,
      game_name,
      creation_method,
    };
  }
}

/**
 * Event sent when a new draft collection is uploaded.
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 */
export class CollectionsDraftUploadedEvent implements MixpanelEvent {
  readonly eventName = "collection_draft_uploaded";
  readonly properties: Record<string, any>;

  constructor(collection_name: string, game_name: string) {
    this.properties = {
      collection_name,
      game_name,
    };
  }
}

/**
 * Event sent when a draft collection update is uploaded.
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 */
export class CollectionsDraftUpdateUploadedEvent implements MixpanelEvent {
  readonly eventName = "collection_draft_updated";
  readonly properties: Record<string, any>;

  constructor(collection_name: string, game_name: string) {
    this.properties = {
      collection_name,
      game_name,
    };
  }
}

/* COLLECTION DOWNLOAD */

/**
 * Event sent when a collection download is clicked/initiated by the user.
 * @param collection_slug Slug of the collection
 * @param game_id ID of the game
 */
export class CollectionsDownloadClickedEvent implements MixpanelEvent {
  readonly eventName = "collections_download_clicked";
  readonly properties: Record<string, any>;
  constructor(collection_slug: string, game_id: number) {
    this.properties = { collection_slug, game_id };
  }
}

/**
 * Event sent when a collection download is completed.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 * @param mod_count Number of mods in the collection
 * @param duration_ms Duration in milliseconds
 */
export class CollectionsDownloadCompletedEvent implements MixpanelEvent {
  readonly eventName = "collections_download_completed";
  readonly properties: Record<string, any>;
  constructor(
    collection_id: string,
    revision_id: string,
    game_id: number,
    file_size: number,
    duration_ms: number,
  ) {
    this.properties = {
      collection_id,
      revision_id,
      game_id,
      file_size,
      duration_ms,
    };
  }
}

/**
 * Event sent when a collection download fails.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 * @param error_code Error code
 * @param error_message Error message
 */
export class CollectionsDownloadFailedEvent implements MixpanelEvent {
  readonly eventName = "collections_download_failed";
  readonly properties: Record<string, any>;
  constructor(
    collection_id: string,
    revision_id: string,
    game_id: number,
    error_code: string,
    error_message: string,
  ) {
    this.properties = {
      collection_id,
      revision_id,
      game_id,
      error_code,
      error_message,
    };
  }
}

/**
 * Event sent when a collection download is cancelled.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 */
export class CollectionsDownloadCancelledEvent implements MixpanelEvent {
  readonly eventName = "collections_download_cancelled";
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: number) {
    this.properties = { collection_id, revision_id, game_id };
  }
}

/* COLLECTION INSTALLATION */

/**
 * Event sent when a collection installation is started (genuine first start). Carries the full
 * count snapshot (required/installed/failed/ignored/optional) + durations, the same shape as the
 * terminal events, so start and end reconcile against the same fields. `mod_count` equals
 * `required_total`.
 */
export class CollectionsInstallationStartedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_started";
  readonly properties: Record<string, any>;
  constructor(props: CollectionInstallOutcomeProps) {
    this.properties = { ...props, mod_count: props.required_total };
  }
}

/**
 * Event sent when a paused collection installation is resumed (distinct from started, which
 * fires once at the genuine first start). Started fires once per install; resumed fires once per
 * resume, so started stays clean as "first start" and reconciles with the terminal events.
 * Carries the full count snapshot (its `resume_count` is part of that shared shape).
 */
export class CollectionsInstallationResumedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_resumed";
  readonly properties: Record<string, any>;
  constructor(props: CollectionInstallOutcomeProps) {
    this.properties = { ...props };
  }
}

/**
 * Shared outcome + count properties for the three terminal collection-install
 * events (completed / failed / cancelled). Sourced from the install session SSOT
 * so the outcomes reconcile: started == completed + failed + cancelled.
 */
export interface CollectionInstallOutcomeProps {
  collection_id: string;
  revision_id: string;
  game_id: number;
  /** Total required members in the collection. */
  required_total: number;
  /** Members (required + optional) that reached "installed". */
  installed: number;
  /** Members that ended in "failed". */
  failed: number;
  /** Members skipped/ignored (unselected optionals, user-ignored). */
  ignored: number;
  /** Total optional (recommended) members. */
  optional: number;
  /** Elapsed time for the current install segment (resets on resume) in milliseconds. */
  duration_ms: number;
  /** Elapsed time from the first start across all pause/resume segments, in milliseconds. */
  total_duration_ms: number;
  /** Times the install was paused, accumulated across restarts. */
  pause_count: number;
  /** Times the install was resumed, accumulated across restarts. */
  resume_count: number;
  /** Whether the install was resumed at least once. */
  was_resumed: boolean;
}

/**
 * Event sent when a collection installation completes with every required mod installed.
 */
export class CollectionsInstallationCompletedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_completed";
  readonly properties: Record<string, any>;
  constructor(props: CollectionInstallOutcomeProps) {
    // mod_count equals the installed count.
    this.properties = { ...props, mod_count: props.installed };
  }
}

/**
 * Event sent when a collection installation finishes in a failed state.
 *
 * `failure_stage` distinguishes the two failure modes:
 *   - "member_install": one or more required members failed to install. There is no
 *     single error (failures happen per-member in InstallManager and can be many); the
 *     `failed` count reports how many, and the per-member causes are on the individual
 *     mods_installation_failed events (joinable via collection_id).
 *   - "postprocessing": applying the collection's mod rules threw a single error, which
 *     is classified into `error_code`.
 */
export class CollectionsInstallationFailedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_failed";
  readonly properties: Record<string, any>;
  constructor(
    props: CollectionInstallOutcomeProps & {
      failure_stage: "member_install" | "postprocessing";
      error_code?: string;
    },
  ) {
    this.properties = { ...props };
  }
}

/**
 * Event sent when a collection installation is cancelled (user abandon, removal, free-user cancel).
 */
export class CollectionsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_cancelled";
  readonly properties: Record<string, any>;
  constructor(props: CollectionInstallOutcomeProps) {
    this.properties = { ...props };
  }
}

/**
 * Event sent when a collection installation is paused (resumable). Distinct from
 * cancelled: the install is expected to resume, so it is not a terminal outcome and
 * does not count toward completed/failed/cancelled. `trigger` records why it paused
 * (user, logout, gamemode-changed).
 */
export class CollectionsInstallationPausedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_paused";
  readonly properties: Record<string, any>;
  constructor(props: CollectionInstallOutcomeProps & { trigger: string }) {
    this.properties = { ...props };
  }
}

/**
 * MOD EVENTS
 */

/**
 * Identity shared by every per-mod analytics event (download and install), so the
 * mod-level events stay consistent with one another and joinable to their collection.
 * `collection_id`/`revision_id` are the parent collection and its revision when the mod
 * is downloaded/installed as part of a collection, otherwise null.
 */
export interface ModAnalyticsIdentity {
  mod_id: string;
  file_id: string;
  game_id: number;
  mod_uid: string;
  file_uid: string;
  collection_id: string | null;
  revision_id: string | null;
}

/**
 * Event sent when a mod download is started from the client. Complements the
 * server-side mods_download_started event to enable success-rate calculations by
 * matching with _completed or _failed.
 * @note "mods_download_started" is taken by the server side; use "mods_download_started_client".
 */
export class ModsDownloadStartedClientEvent implements MixpanelEvent {
  readonly eventName = "mods_download_started_client";
  readonly properties: Record<string, any>;
  constructor(props: ModAnalyticsIdentity) {
    this.properties = { ...props };
  }
}

/**
 * Resume history for a download, surfaced on terminal download events. `pause_count`
 * accumulates across app restarts.
 */
export interface DownloadResumeInfo {
  pause_count: number;
  was_resumed: boolean;
}

/** Event sent when a mod download is completed. */
export class ModsDownloadCompletedEvent implements MixpanelEvent {
  readonly eventName = "mods_download_completed";
  readonly properties: Record<string, any>;
  constructor(
    props: ModAnalyticsIdentity & { file_size: number; duration_ms: number } & DownloadResumeInfo,
  ) {
    this.properties = { ...props };
  }
}

/** Event sent when a mod download is cancelled. */
export class ModsDownloadCancelledEvent implements MixpanelEvent {
  readonly eventName = "mods_download_cancelled";
  readonly properties: Record<string, any>;
  constructor(props: ModAnalyticsIdentity) {
    this.properties = { ...props };
  }
}

/** Event sent when a mod download fails. */
export class ModsDownloadFailedEvent implements MixpanelEvent {
  readonly eventName = "mods_download_failed";
  readonly properties: Record<string, any>;
  constructor(
    props: ModAnalyticsIdentity & {
      error_code: string;
      error_message: string;
    } & DownloadResumeInfo,
  ) {
    this.properties = { ...props };
  }
}

/**
 * What kind of install produced a mod, on the mods_installation_* events. Lets the data team
 * separate fresh installs from version bumps, reinstalls, and the two name-conflict resolutions.
 *   - fresh: no prior version of this mod was installed.
 *   - version_update: a different file (version) of an already-installed mod.
 *   - reinstall: the same file (version) reinstalled over itself.
 *   - variant: installed as a second, coexisting copy under a different variant name.
 *   - profile_replace: replaced the existing mod across all local profiles.
 */
export type ModInstallKind =
  | "fresh"
  | "version_update"
  | "reinstall"
  | "variant"
  | "profile_replace";

/** Fields shared by every per-mod install event: identity + how the install came about. */
type ModInstallProps = ModAnalyticsIdentity & { install_kind: ModInstallKind };

/** Event sent when mod installation is started. Not sent for the collection bundle/manifest mod. */
export class ModsInstallationStartedEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_started";
  readonly properties: Record<string, any>;
  constructor(props: ModInstallProps) {
    this.properties = { ...props };
  }
}

/** Event sent when mod installation is completed. Not sent for the collection bundle/manifest mod. */
export class ModsInstallationCompletedEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_completed";
  readonly properties: Record<string, any>;
  constructor(props: ModInstallProps & { duration_ms: number }) {
    this.properties = { ...props };
  }
}

/** Event sent when mod installation is cancelled. Not sent for the collection bundle/manifest mod. */
export class ModsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_cancelled";
  readonly properties: Record<string, any>;
  constructor(props: ModInstallProps) {
    this.properties = { ...props };
  }
}

/** Event sent when mod installation fails. Not sent for the collection bundle/manifest mod. */
export class ModsInstallationFailedEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_failed";
  readonly properties: Record<string, any>;
  constructor(props: ModInstallProps & { error_code: string; error_message: string }) {
    this.properties = { ...props };
  }
}

/**
 * Why a mod was enabled/disabled/removed, on the ModsStateChanged / ModsRemoved events.
 * A small, closed vocabulary so the data team can slice programmatic churn (collection
 * updates/uninstalls, variant/version/profile replacement, health-check remediation) from
 * user-driven changes. Install-completion enables are not represented here: they are covered
 * by the mods_installation_* events, so no enable is emitted for them.
 */
export type ModChangeReason =
  | "user_manual"
  | "variant_replace"
  | "version_update"
  | "profile_replace"
  | "collection_update"
  | "collection_uninstall"
  | "stop_managing_game"
  | "health_check";

/**
 * Event sent when a mod is enabled or disabled in a profile. Shares the per-mod identity
 * so it joins to the mod's download/install events; `reason` records what drove the change.
 * Not sent for the collection mod itself (collections have their own lifecycle events) nor
 * for mods without a Nexus file id (bundled/local), matching the other per-mod events.
 *
 * `duration_ms` is how long the mod spent in the prior state before this change: time enabled on
 * a disable, time disabled on an enable. 0 when that span is unknown (never in that state).
 */
export class ModsStateChangedEvent implements MixpanelEvent {
  readonly eventName = "mods_state_changed";
  readonly properties: Record<string, any>;
  constructor(
    props: ModAnalyticsIdentity & {
      change: "enabled" | "disabled";
      reason: ModChangeReason;
      duration_ms: number;
    },
  ) {
    this.properties = { ...props };
  }
}

/**
 * Event sent when a mod is removed. `will_be_replaced` marks removals that are part of a
 * reinstall/variant/version replacement (a new mod takes its place) rather than a genuine
 * uninstall. Same gating and identity as ModsStateChangedEvent.
 */
export class ModsRemovedEvent implements MixpanelEvent {
  readonly eventName = "mods_removed";
  readonly properties: Record<string, any>;
  constructor(
    props: ModAnalyticsIdentity & { reason: ModChangeReason; will_be_replaced: boolean },
  ) {
    this.properties = { ...props };
  }
}

/**
 * DEPLOYMENT EVENTS
 */

/** Fields on the mods_deployed event. */
export interface ModsDeployedProps {
  game_id: number | null;
  deployment_method: string;
  file_count: number;
  enabled_mod_count: number;
  manual: boolean;
  is_collection_postprocess: boolean;
}

/**
 * Sent when a deployment to the game directory completes successfully. `deployment_method` is the
 * activator (hardlink, symlink, ...); `manual` marks a user-triggered deploy over an automatic one;
 * `is_collection_postprocess` marks the deploy Vortex runs while finishing a collection install.
 */
export class ModsDeployedEvent implements MixpanelEvent {
  readonly eventName = "mods_deployed";
  readonly properties: Record<string, unknown>;
  constructor(props: ModsDeployedProps) {
    this.properties = { ...props };
  }
}

/**
 * EXTENSION EVENTS
 */

/**
 * Fields on the app_extension_installed event. The identity is sourced from the installed IExtension
 * but reported in snake_case like every other event. `extension_type` collapses to "game" vs
 * "other" (only game-support extensions are distinguished). `game_domain` / `game_name` name the
 * supported game for game extensions (from the central manifest, so absent on manual installs).
 * `is_update` marks an install that replaced a previous version.
 */
export interface AppExtensionInstalledProps {
  extension_id?: string;
  extension_name: string;
  author: string;
  version: string;
  mod_id?: number;
  extension_type: "game" | "other";
  game_domain?: string;
  game_name?: string;
  source: ExtensionInstallSource;
  is_update: boolean;
}

/** Sent when a Vortex extension finishes installing. */
export class AppExtensionInstalledEvent implements MixpanelEvent {
  readonly eventName = "app_extension_installed";
  readonly properties: Record<string, unknown>;
  constructor(props: AppExtensionInstalledProps) {
    this.properties = { ...props };
  }
}

/**
 * HEALTH CHECK EVENTS
 */

/**
 * Event sent when a user provides feedback on a health check requirement.
 * @param feedback_type Whether the feedback was positive or negative
 * @param game_id Game domain ID
 * @param mod_id Nexus mod ID of the missing requirement
 * @param required_by_mod_id Nexus mod ID of the mod that requires the dependency
 * @param feedback_reasons Array of reason keys (only for negative feedback)
 */
export class HealthCheckFeedbackEvent implements MixpanelEvent {
  readonly eventName = "health_check_feedback";
  readonly properties: Record<string, any>;
  constructor(
    feedback_type: "positive" | "negative",
    game_id: string,
    mod_id: number,
    required_by_mod_id: number,
    feedback_reasons?: string[],
  ) {
    this.properties = {
      feedback_type,
      game_id,
      mod_id,
      required_by_mod_id,
      ...(feedback_reasons?.length ? { feedback_reasons } : {}),
    };
  }
}
