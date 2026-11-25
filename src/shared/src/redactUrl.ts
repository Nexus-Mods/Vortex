const REDACTED = "<redacted>";

/** Query parameters whose value is kept: it tells when a signed link expires, and is never a secret. */
const KEPT_PARAMS: ReadonlySet<string> = new Set(["expires"]);

/** `user:password@` after the scheme, up to the last `@` before the path. */
const USERINFO_RE = /^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i;

const redactParam = (pair: string): string => {
  const separator = pair.indexOf("=");
  if (separator === -1) return pair === "" ? pair : REDACTED;
  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  return value === "" || KEPT_PARAMS.has(name.toLowerCase()) ? pair : `${name}=${REDACTED}`;
};

/**
 * A URL that is safe to write to the log. Signed download links, `nxm://` links, upload targets
 * and OAuth callbacks carry their credential in the query or fragment, so every query value is
 * redacted (except {@link KEPT_PARAMS}), the fragment is redacted whole and `user:password@` is
 * dropped. Scheme, host, path and parameter names are kept, so a log line still shows which link
 * it was.
 */
export function redactUrlForLog(url: string | URL): string;
export function redactUrlForLog(url: string | URL | undefined): string | undefined;
export function redactUrlForLog(url: string | URL | undefined): string | undefined {
  if (url === undefined) return undefined;
  const text = url.toString().replace(USERINFO_RE, `$1${REDACTED}@`);

  const hashAt = text.indexOf("#");
  const beforeHash = hashAt === -1 ? text : text.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");

  let out = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  if (queryAt !== -1) {
    out += `?${beforeHash
      .slice(queryAt + 1)
      .split("&")
      .map(redactParam)
      .join("&")}`;
  }
  if (hashAt !== -1) out += hashAt === text.length - 1 ? "#" : `#${REDACTED}`;
  return out;
}

/**
 * A URL in free text: scheme, then everything up to whitespace or a quote, not ending on
 * punctuation, so the `).` of `(see https://…).` stays outside it.
 */
const URL_IN_TEXT_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>`]*[^\s"'<>`)\]},.;:]/gi;

/** {@link redactUrlForLog} for every URL in a piece of text. */
export function redactUrlsInText(text: string): string {
  return text.replace(URL_IN_TEXT_RE, (match) => redactUrlForLog(match));
}

/** Command-line switches whose value is a credential or identifies the user (Epic launch arguments). */
const SECRET_SWITCHES: ReadonlySet<string> = new Set([
  "-auth_login",
  "-auth_password",
  "-epicusername",
  "-epicuserid",
  "--epic-auth-login",
  "--epic-auth-password",
  "--epic-username",
  "--epic-userid",
]);

const isSecretSwitch = (arg: string | undefined): boolean =>
  arg !== undefined && SECRET_SWITCHES.has(arg.toLowerCase());

/**
 * A command line that is safe to write to the log: the values of {@link SECRET_SWITCHES}
 * (`-x=value` or `-x value`) are redacted, and every URL goes through {@link redactUrlForLog}.
 */
export function redactArgvForLog(argv: readonly string[]): string[] {
  return argv.map((arg, index) => {
    const separator = arg.indexOf("=");
    if (separator !== -1 && isSecretSwitch(arg.slice(0, separator))) {
      return `${arg.slice(0, separator)}=${REDACTED}`;
    }
    if (isSecretSwitch(argv[index - 1])) return REDACTED;
    return redactUrlsInText(arg);
  });
}
