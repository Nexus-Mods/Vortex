// --- Branded type definitions ---

/**
 * A URI identifying a service or resource (e.g. 'vortex:host/ping').
 * Must match scheme:path format.
 */
export type URI = string & { readonly __brand: "URI" };

/**
 * A process identifier assigned to each loaded adaptor (e.g. 'pid:1').
 * Used for routing messages.
 */
export type PID = string & { readonly __brand: "PID" };

/**
 * A unique message identifier for request/response correlation (e.g. 'msg:42').
 */
export type MessageId = string & { readonly __brand: "MessageId" };

/**
 * A semantic version string (e.g. '1.0.0' or '1.0.0-beta.1').
 */
export type SemVer = string & { readonly __brand: "SemVer" };

/**
 * A valid adaptor name containing only [a-zA-Z0-9_-] characters.
 */
export type AdaptorName = string & { readonly __brand: "AdaptorName" };

// --- Constructors with validation ---

const URI_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:.+$/;

/**
 * Validates and brands a string as a {@link URI}.
 * Throws if the format is invalid.
 */
export function uri(value: string): URI {
  if (!URI_PATTERN.test(value)) {
    throw new Error(`Invalid URI: "${value}" — must match scheme:path (e.g. "vortex:host/ping")`);
  }
  return value as URI;
}

const PID_PATTERN = /^pid:.+$/;

/**
 * Validates and brands a string as a {@link PID}.
 * Throws if the format is invalid.
 */
export function pid(value: string): PID {
  if (!PID_PATTERN.test(value)) {
    throw new Error(`Invalid PID: "${value}" — must match "pid:<id>" (e.g. "pid:42")`);
  }
  return value as PID;
}

const MSG_ID_PATTERN = /^msg:.+$/;

/**
 * Validates and brands a string as a {@link MessageId}.
 * Throws if the format is invalid.
 */
export function messageId(value: string): MessageId {
  if (!MSG_ID_PATTERN.test(value)) {
    throw new Error(`Invalid MessageId: "${value}" — must match "msg:<id>" (e.g. "msg:abc-123")`);
  }
  return value as MessageId;
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

/**
 * Validates and brands a string as a {@link SemVer}.
 * Throws if the format is invalid.
 */
export function semver(value: string): SemVer {
  if (!SEMVER_PATTERN.test(value)) {
    throw new Error(`Invalid SemVer: "${value}" — must match "x.y.z" (e.g. "1.0.0")`);
  }
  return value as SemVer;
}

const ADAPTOR_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates and brands a string as an {@link AdaptorName}.
 * Throws if the format is invalid.
 */
export function adaptorName(value: string): AdaptorName {
  if (!ADAPTOR_NAME_PATTERN.test(value)) {
    throw new Error(
      `Invalid AdaptorName: "${value}" — must contain only [a-zA-Z0-9_-]`,
    );
  }
  return value as AdaptorName;
}
