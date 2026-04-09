// --- Branded type definitions ---

/**
 * A Steam application ID (positive integer, e.g. 72850).
 */
export type SteamAppId = number & { readonly __brand: "SteamAppId" };

/**
 * An Epic Games catalog namespace (hex string, e.g. "ac82db5035584c7f8a2c548d98c200a1").
 */
export type EpicCatalogNamespace = string & {
  readonly __brand: "EpicCatalogNamespace";
};

/**
 * An Epic Games catalog item ID (hex string, e.g. "d5241c76f17840b2953a9a6b76e6c890").
 */
export type EpicCatalogItemId = string & {
  readonly __brand: "EpicCatalogItemId";
};

/**
 * A GOG game ID (positive integer, e.g. 1508702879).
 */
export type GOGGameId = number & { readonly __brand: "GOGGameId" };

/**
 * An Xbox package family name (e.g. "BethesdaSoftworks.SkyrimSE_3275kfvn8vcwc").
 */
export type XboxPackageFamilyName = string & {
  readonly __brand: "XboxPackageFamilyName";
};

/**
 * A Nexus Mods game domain slug (lowercase alphanumeric, e.g. "skyrimspecialedition").
 */
export type NexusModsDomain = string & { readonly __brand: "NexusModsDomain" };

/**
 * A Windows registry key path (e.g. "HKEY_LOCAL_MACHINE\\SOFTWARE\\Bethesda Softworks\\Skyrim").
 */
export type RegistryKey = string & { readonly __brand: "RegistryKey" };

// --- Constructors with validation ---

/**
 * Validates and brands a number as a {@link SteamAppId}.
 * Must be a positive integer.
 */
export function steamAppId(value: number): SteamAppId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid SteamAppId: ${value} — must be a positive integer`,
    );
  }
  return value as SteamAppId;
}

const EPIC_HEX_PATTERN = /^[a-f0-9]+$/;

/**
 * Validates and brands a string as an {@link EpicCatalogNamespace}.
 * Must be a non-empty hex string.
 */
export function epicCatalogNamespace(value: string): EpicCatalogNamespace {
  if (!EPIC_HEX_PATTERN.test(value)) {
    throw new Error(
      `Invalid EpicCatalogNamespace: "${value}" — must be a non-empty hex string`,
    );
  }
  return value as EpicCatalogNamespace;
}

/**
 * Validates and brands a string as an {@link EpicCatalogItemId}.
 * Must be a non-empty hex string.
 */
export function epicCatalogItemId(value: string): EpicCatalogItemId {
  if (!EPIC_HEX_PATTERN.test(value)) {
    throw new Error(
      `Invalid EpicCatalogItemId: "${value}" — must be a non-empty hex string`,
    );
  }
  return value as EpicCatalogItemId;
}

/**
 * Validates and brands a number as a {@link GOGGameId}.
 * Must be a positive integer.
 */
export function gogGameId(value: number): GOGGameId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid GOGGameId: ${value} — must be a positive integer`);
  }
  return value as GOGGameId;
}

const XBOX_PFN_PATTERN = /^[^\s]+$/;

/**
 * Validates and brands a string as an {@link XboxPackageFamilyName}.
 * Must be a non-empty string with no whitespace.
 */
export function xboxPackageFamilyName(value: string): XboxPackageFamilyName {
  if (!value || !XBOX_PFN_PATTERN.test(value)) {
    throw new Error(
      `Invalid XboxPackageFamilyName: "${value}" — must be a non-empty string with no whitespace`,
    );
  }
  return value as XboxPackageFamilyName;
}

const NEXUS_DOMAIN_PATTERN = /^[a-z0-9]+$/;

/**
 * Validates and brands a string as a {@link NexusModsDomain}.
 * Must be a non-empty lowercase alphanumeric string.
 */
export function nexusModsDomain(value: string): NexusModsDomain {
  if (!NEXUS_DOMAIN_PATTERN.test(value)) {
    throw new Error(
      `Invalid NexusModsDomain: "${value}" — must be a non-empty lowercase alphanumeric string`,
    );
  }
  return value as NexusModsDomain;
}

const REGISTRY_KEY_PATTERN =
  /^HKEY_(LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)\\.+$/;

/**
 * Validates and brands a string as a {@link RegistryKey}.
 * Must start with a valid HKEY_ root followed by a backslash-separated path.
 */
export function registryKey(value: string): RegistryKey {
  if (!REGISTRY_KEY_PATTERN.test(value)) {
    throw new Error(
      `Invalid RegistryKey: "${value}" — must start with a valid HKEY_ root (e.g. "HKEY_LOCAL_MACHINE\\SOFTWARE\\...")`,
    );
  }
  return value as RegistryKey;
}
