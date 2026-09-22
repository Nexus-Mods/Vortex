/**
 * Redaction applied to every text file in a support bundle before it is archived.
 *
 * The aim is to remove what identifies the person or grants access to something, and nothing
 * else: paths keep their shape, URLs keep their host, file and expiry, so a log still says
 * exactly which file on which server failed and when.
 *
 * The username rule matches the convention `sanitizeFramePath` in `@vortex/shared` uses for
 * telemetry (`<USER>`), but does not share its code: that helper also strips install prefixes
 * and flips every backslash to a slash, which would rewrite the very paths we want to keep.
 */

export const USER_PLACEHOLDER = "<USER>";
export const SECRET_PLACEHOLDER = "REDACTED";

/**
 * The account segment of a Windows profile path. Logs and `state.json` carry paths both raw
 * (`C:\Users\bob`) and JSON-escaped (`C:\\Users\\bob`), and sometimes with forward slashes,
 * so all three separators are accepted. Backslash is excluded from the name so an escaped
 * separator ends the match. `<` and `>` are excluded so a second pass leaves `<USER>` alone.
 */
const WINDOWS_USER_HOME_RE = /([a-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/))([^\\/\t\r\n'"<>:|?*]+)/gi;

/** `/Users/<name>` (macOS) and `/home/<name>` (Linux). Not preceded by a drive letter colon. */
const POSIX_USER_HOME_RE = /((?:^|[^a-z:])\/(?:Users|home)\/)([^\\/\t\r\n'"<>:|?*]+)/gi;

/**
 * Query parameters whose value grants access. `md5` is on the list because on Nexus CDN links
 * it is the access token, not a checksum. `expires` and `user_id` are deliberately left alone:
 * an expired link is a diagnosis in itself, and the numeric id is already in the manifest.
 */
const SIGNED_QUERY_PARAM_RE =
  /((?:[?&]|&amp;)(?:md5|key|apikey|api_key|sig|signature|jwt|token|x-amz-signature|x-amz-credential|x-amz-security-token)=)([^&"'\s\\<>]+)/gi;

export function redactUserPaths(text: string): string {
  return text
    .replace(WINDOWS_USER_HOME_RE, `$1${USER_PLACEHOLDER}`)
    .replace(POSIX_USER_HOME_RE, `$1${USER_PLACEHOLDER}`);
}

export function redactSignedUrls(text: string): string {
  return text.replace(SIGNED_QUERY_PARAM_RE, `$1${SECRET_PLACEHOLDER}`);
}

/** Everything the bundle applies to log text and the state export. Idempotent. */
export function redactSensitiveText(text: string): string {
  return redactSignedUrls(redactUserPaths(text));
}

/**
 * The one thing a username tells us that its placeholder does not: a non-ASCII profile path is
 * a known trigger for native module and path handling failures. Reported as a flag instead.
 */
export function hasNonAscii(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7f]/.test(text);
}
