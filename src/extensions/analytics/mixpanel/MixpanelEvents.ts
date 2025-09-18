/**
 * Interface for all Mixpanel events
 */
export interface MixpanelEvent {
  readonly eventName: string;
  readonly properties: Record<string, any>;
}



/**
 * APP EVENTS
 */



/**
 * App launched event - sent when Vortex starts up
 * @param os Operating system
 */
export class AppLaunchedEvent implements MixpanelEvent {
  readonly eventName = 'app_launched';
  readonly properties: Record<string, any>;

  constructor(os: string) {
    this.properties = {
      os: os,
    };
  }
}


/**
 * App start game event - sent when Vortex launches a game
 * @param game_id ID of the game being launched
 * @param enabled_mods_count Number of enabled mods for the game
 * @param enabled_collections_count Number of enabled collections for the game
 */
export class AppStartGameEvent implements MixpanelEvent {
  readonly eventName = 'app_start_game';
  readonly properties: Record<string, any>;

  constructor(game_id: string, enabled_mods_count: number, enabled_collections_count: number) {
    this.properties = {
      game_id: game_id,
      enabled_mods_count: enabled_mods_count,
      enabled_collections_count: enabled_collections_count,
    };
  }
}


/**
 * DNU - NEEDS TO BE FIRED BEFORE ANALYTICS ARE INITIALIZED
 * Event sent when the application is updated.
 * @param from_version Previous version
 * @param to_version New version
 * @param os Operating system
 */
export class AppUpdatedEvent implements MixpanelEvent {
  readonly eventName = 'app_updated';
  readonly properties: Record<string, any>;
  constructor(from_version: string, to_version: string, os: string) {
    this.properties = { from_version, to_version, os };
  }
}

/**
 * Event sent when the application crashes.
 * @param os Operating system
 * @param error_code Error code
 * @param error_message Error message
 */
export class AppCrashedEvent implements MixpanelEvent {
  readonly eventName = 'app_crashed';
  readonly properties: Record<string, any>;
  constructor(os: string, error_code: string, error_message: string) {
    this.properties = { os, error_code, error_message };
  }
}

/**
 * Event sent when an upsell prompt is clicked in the application.
 */
export class AppUpsellClickedEvent implements MixpanelEvent {
  readonly eventName = 'app_upsell_clicked';
  readonly properties: Record<string, any> = {};
  constructor() { }
}



/**
 * COLLECTION EVENTS
 */



/* COLLECTION DOWNLOAD */

/**
 * Event sent when a collection download is completed.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision 
 * @param game_id ID of the game
 * @param mod_count Number of mods in the collection
 * @param duration_ms Duration in milliseconds
 */
export class CollectionsDownloadCompletedEvent implements MixpanelEvent {
  readonly eventName = 'collections_download_completed';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string, file_size: number, duration_ms: number) {
    this.properties = { collection_id, revision_id, game_id, file_size, duration_ms };
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
  readonly eventName = 'collections_download_failed';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string, error_code: string, error_message: string) {
    this.properties = { collection_id, revision_id, game_id, error_code, error_message };
  }
}

/**
 * Event sent when a collection download is cancelled.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 */
export class CollectionsDownloadCancelledEvent implements MixpanelEvent {
  readonly eventName = 'collections_download_cancelled';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string) {
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
  readonly eventName = 'collections_installation_started';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string, mod_count: number) {
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
  readonly eventName = 'collections_installation_completed';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string, mod_count: number, duration_ms: number) {
    this.properties = { collection_id, revision_id, game_id, mod_count, duration_ms };
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
  readonly eventName = 'collections_installation_failed';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string, error_code: string, error_message: string) {
    this.properties = { collection_id, revision_id, game_id, error_code, error_message };
  }
}

/**
 * Event sent when a collection installation is cancelled.
 * @param collection_id ID of the collection
 * @param revision_id ID of the revision
 * @param game_id ID of the game
 */
export class CollectionsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = 'collections_installation_cancelled';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, revision_id: string, game_id: string) {
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
  readonly eventName = 'mods_download_started';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string) {
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
  readonly eventName = 'mods_download_completed';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string, file_size: number, duration_ms: number) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid, file_size, duration_ms };
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
  readonly eventName = 'mods_download_cancelled';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string) {
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
  readonly eventName = 'mods_download_failed';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string, error_code: string, error_message: string) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid, error_code, error_message };
  }
}

/** DONE
 * Event sent when mod installation is started.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 */
export class ModsInstallationStartedEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_started';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid };
  }
}

/** DONE
 * Event sent when mod installation is completed.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 * @param duration_ms Duration in milliseconds
 */
export class ModsInstallationCompletedEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_completed';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string, duration_ms: number) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid, duration_ms };
  }
}

/**
 * Event sent when mod installation is cancelled.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 */
export class ModsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_cancelled';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid };
  }
}

/** DONE
 * Event sent when mod installation fails.
 * @param mod_id ID of the mod
 * @param file_id ID of the file
 * @param game_id ID of the game
 * @param mod_uid UID of the mod
 * @param file_uid UID of the file
 * @param error_code Error code
 * @param error_message Error message
 */
export class ModsInstallationFailedEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_failed';
  readonly properties: Record<string, any>;
  constructor(mod_id: string, file_id: string, game_id: string, mod_uid: string, file_uid: string, error_code: string, error_message: string) {
    this.properties = { mod_id, file_id, game_id, mod_uid, file_uid, error_code, error_message };
  }
}