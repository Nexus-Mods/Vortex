/**
 * Interface for all Mixpanel events
 */
export interface MixpanelEvent {
  readonly eventName: string;
  readonly properties: Record<string, any>;
}

/**
 * App launched event - sent when Vortex starts up
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
 * Event sent when a community endorsement is given to a mod.
 * @param mod_id ID of the mod endorsed
 */
export class CommunityEndorsementGivenEvent implements MixpanelEvent {
  readonly eventName = 'community_endorsement_given';
  readonly properties: Record<string, any>;
  constructor(mod_id: string) {
    this.properties = { mod_id };
  }
}

/**
 * Event sent when a community endorsement is removed from a mod.
 * @param mod_id ID of the mod
 */
export class CommunityEndorsementRemovedEvent implements MixpanelEvent {
  readonly eventName = 'community_endorsement_removed';
  readonly properties: Record<string, any>;
  constructor(mod_id: string) {
    this.properties = { mod_id };
  }
}



/**
 * Event sent when a collection download is completed.
 * @param collection_id ID of the collection
 * @param mod_count Number of mods in the collection
 * @param duration_ms Duration in milliseconds
 * @param game_id ID of the game
 */
export class CollectionsDownloadCompletedEvent implements MixpanelEvent {
  readonly eventName = 'collections_download_completed';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, mod_count: number, duration_ms: number, game_id: string) {
    this.properties = { collection_id, mod_count, duration_ms, game_id };
  }
}

/**
 * Event sent when a collection download fails.
 * @param collection_id ID of the collection
 * @param error_code Error code
 * @param error_message Error message
 */
export class CollectionsDownloadFailedEvent implements MixpanelEvent {
  readonly eventName = 'collections_download_failed';
  readonly properties: Record<string, any>;
  constructor(collection_id: string, error_code: string, error_message: string) {
    this.properties = { collection_id, error_code, error_message };
  }
}

/**
 * Event sent when a mod download is started.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 */
export class ModsDownloadStartedEvent implements MixpanelEvent {
  readonly eventName = 'mods_download_started';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string) {
    this.properties = { file_id, mod_id, game_id };
  }
}

/** DONE
 * Event sent when a mod download is completed.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 * @param file_size Size of the file
 * @param duration_ms Duration in milliseconds
 */
export class ModsDownloadCompletedEvent implements MixpanelEvent {
  readonly eventName = 'mods_download_completed';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string, file_size: number, duration_ms: number) {
    this.properties = { file_id, mod_id, game_id, file_size, duration_ms };
  }
}

/** DONE
 * Event sent when a mod download fails.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 * @param error_code Error code
 * @param error_message Error message
 */
export class ModsDownloadFailedEvent implements MixpanelEvent {
  readonly eventName = 'mods_download_failed';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string, error_code: string, error_message: string) {
    this.properties = { file_id, mod_id, game_id, error_code, error_message };
  }
}


/** DONE
 * Event sent when mod installation is started.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 */
export class ModsInstallationStartedEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_started';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string) {
    this.properties = { file_id, mod_id, game_id };
  }
}

/** DONE
 * Event sent when mod installation fails.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 * @param error_code Error code
 * @param error_message Error message
 */
export class ModsInstallationFailedEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_failed';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string, error_code: string, error_message: string) {
    this.properties = { file_id, mod_id, game_id, error_code, error_message };
  }
}

/** DONE
 * Event sent when mod installation is completed.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 * @param duration_ms Duration in milliseconds
 */
export class ModsInstallationCompletedEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_completed';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string, duration_ms: number) {
    this.properties = { file_id, mod_id, game_id, duration_ms };
  }
}

/**
 * Event sent when mod installation is cancelled.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 */
export class ModsInstallationCancelledEvent implements MixpanelEvent {
  readonly eventName = 'mods_installation_cancelled';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string) {
    this.properties = { file_id, mod_id, game_id };
  }
}

/**
 * Event sent when mod download is cancelled.
 * @param file_id ID of the file
 * @param mod_id ID of the mod
 * @param game_id ID of the game
 */
export class ModsDownloadCancelledEvent implements MixpanelEvent {
  readonly eventName = 'mods_download_cancelled';
  readonly properties: Record<string, any>;
  constructor(file_id: string, mod_id: string, game_id: string) {
    this.properties = { file_id, mod_id, game_id };
  }
}