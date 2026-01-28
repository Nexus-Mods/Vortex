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
 * Event sent when the application crashes.
 * @param os Operating system (Node.js platform string: win32, darwin, linux)
 * @param error_code Error code
 * @param error_message Error message
 */
export class AppCrashedEvent implements MixpanelEvent {
  readonly eventName = "app_crashed";
  readonly properties: Record<string, any>;
  constructor(os: string, error_code: string, error_message: string) {
    this.properties = {
      $os: mapPlatformToMixpanel(os),
      error_code,
      error_message,
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

/**
 * COLLECTION EVENTS
 */

/* COLLECTION DRAFTING AND UPLOADING */

/**
 * Event sent when a collection draft is created in Vortex.
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 * @param user_id Nexus Mods user ID
 * @param creation_method How the collection was created
 */
export class CollectionsDraftedEvent implements MixpanelEvent {
  readonly eventName = "Collections: Collection drafted in Vortex";
  readonly properties: Record<string, any>;

  constructor(
    collection_name: string,
    game_name: string,
    user_id: number,
    creation_method: "from_profile" | "quick_collection" | "empty",
  ) {
    this.properties = {
      collection_name,
      game_name,
      user_id,
      creation_method,
    };
  }
}

/**
 * Event sent when a new draft collection is uploaded.
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 * @param user_id Nexus Mods user ID
 */
export class CollectionsDraftUploadedEvent implements MixpanelEvent {
  readonly eventName = "Collections: Draft uploaded";
  readonly properties: Record<string, any>;

  constructor(collection_name: string, game_name: string, user_id: number) {
    this.properties = {
      collection_name,
      game_name,
      user_id,
    };
  }
}

/**
 * Event sent when a draft collection update is uploaded.
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 * @param user_id Nexus Mods user ID
 */
export class CollectionsDraftUpdateUploadedEvent implements MixpanelEvent {
  readonly eventName = "Collections: Draft update uploaded";
  readonly properties: Record<string, any>;

  constructor(collection_name: string, game_name: string, user_id: number) {
    this.properties = {
      collection_name,
      game_name,
      user_id,
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

/** *
 * Event sent when a collection installation is started.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 * @param mod_count Number of mods in the collection
 */
export class CollectionsInstallationStartedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_started";
  readonly properties: Record<string, any>;
  constructor(
    collection_id: string,
    revision_id: string,
    game_id: number,
    mod_count: number,
  ) {
    this.properties = { collection_id, revision_id, game_id, mod_count };
  }
}

/**
 * Event sent when a collection installation is completed.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 * @param mod_count Number of mods in the collection
 * @param duration_ms Duration in milliseconds
 */
export class CollectionsInstallationCompletedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_completed";
  readonly properties: Record<string, any>;
  constructor(
    collection_id: string,
    revision_id: string,
    game_id: number,
    mod_count: number,
    duration_ms: number,
  ) {
    this.properties = {
      collection_id,
      revision_id,
      game_id,
      mod_count,
      duration_ms,
    };
  }
}

/**
 * Event sent when a collection installation fails.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 * @param error_code Error code
 * @param error_message Error message
 */
export class CollectionsInstallationFailedEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_failed";
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
 * Event sent when a collection installation is cancelled.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 */
export class CollectionsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = "collections_installation_cancelled";
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: number) {
    this.properties = { collection_id, revision_id, game_id };
  }
}

/**
 * MOD EVENTS
 */

/**
 * (DO NOT USE) This event is currently being tracked SERVER side
 *
 * Event sent when a mod download is started.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 */
export class ModsDownloadStartedEvent implements MixpanelEvent {
  readonly eventName = "mods_download_started";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
  ) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid };
  }
}

/** DONE
 * Event sent when a mod download is completed.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 * @param file_size Size of the file
 * @param duration_ms Duration in milliseconds
 */
export class ModsDownloadCompletedEvent implements MixpanelEvent {
  readonly eventName = "mods_download_completed";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
    file_size: number,
    duration_ms: number,
  ) {
    this.properties = {
      mod_id,
      file_id,
      game_id,
      mod_uid,
      file_uid,
      file_size,
      duration_ms,
    };
  }
}

/**
 * Event sent when mod download is cancelled.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 */
export class ModsDownloadCancelledEvent implements MixpanelEvent {
  readonly eventName = "mods_download_cancelled";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
  ) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid };
  }
}

/** DONE
 * Event sent when a mod download fails.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 * @param error_code Error code
 * @param error_message Error message
 */
export class ModsDownloadFailedEvent implements MixpanelEvent {
  readonly eventName = "mods_download_failed";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
    error_code: string,
    error_message: string,
  ) {
    this.properties = {
      mod_id,
      file_id,
      game_id,
      mod_uid,
      file_uid,
      error_code,
      error_message,
    };
  }
}

/** DONE
 * Event sent when mod installation is started. Not sent for collection bundle/manifest mod.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 */
export class ModsInstallationStartedEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_started";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
  ) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid };
  }
}

/** DONE
 * Event sent when mod installation is completed. Not sent for collection bundle/manifest mod.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 * @param duration_ms Duration in milliseconds
 */
export class ModsInstallationCompletedEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_completed";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
    duration_ms: number,
  ) {
    this.properties = {
      mod_id,
      file_id,
      game_id,
      mod_uid,
      file_uid,
      duration_ms,
    };
  }
}

/**
 * Event sent when mod installation is cancelled. Not sent for collection bundle/manifest mod.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 */
export class ModsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_cancelled";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
  ) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid };
  }
}

/** DONE
 * Event sent when mod installation fails. Not sent for collection bundle/manifest mod.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 * @param error_code Error code
 * @param error_message Error message
 */
export class ModsInstallationFailedEvent implements MixpanelEvent {
  readonly eventName = "mods_installation_failed";
  readonly properties: Record<string, any>;
  constructor(
    mod_id: string,
    file_id: string,
    game_id: number,
    mod_uid: string,
    file_uid: string,
    error_code: string,
    error_message: string,
  ) {
    this.properties = {
      mod_id,
      file_id,
      game_id,
      mod_uid,
      file_uid,
      error_code,
      error_message,
    };
  }
}
