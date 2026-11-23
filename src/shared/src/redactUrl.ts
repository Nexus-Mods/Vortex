const REDACTED = "<redacted>";

/**
 * Query parameters redacted even when their value looks plain. Everything else is redacted by
 * {@link PLAIN_VALUE_RE} alone: tokens, signatures and API keys are long or mix letters and
 * digits, so they never look plain. These are the names whose value can: a numeric user id, a
 * username or password that is a dictionary word, or a short random key, code or state that
 * happens to be all letters.
 */
const SENSITIVE_PARAMS: ReadonlySet<string> = new Set([
  "user_id",
  "userid",
  "user",
  "username",
  "password",
  "key",
  "code",
  "state",
]);

/**
 * A value that can't be a credential: a number (an id, a timestamp such as `expires`), or a
 * short word of letters (`tab=files`, `campaign=collections`). Tokens and signatures mix
 * letters and digits or run long, so they don't pass.
 */
const PLAIN_VALUE_RE = /^(?:\d{1,20}|[A-Za-z][A-Za-z_-]{0,23})$/;

const redactValue = (name: string, value: string): string =>
  value === "" || (!SENSITIVE_PARAMS.has(name.toLowerCase()) && PLAIN_VALUE_RE.test(value))
    ? value
    : REDACTED;

/** Redact the values of `a=b&c=d`, keeping every name so the shape of the URL stays readable. */
const redactParams = (params: string): string =>
  params
    .split("&")
    .map((pair) => {
      const separator = pair.indexOf("=");
      if (separator === -1) return redactValue("", pair);
      const name = pair.slice(0, separator);
      return `${name}=${redactValue(name, pair.slice(separator + 1))}`;
    })
    .join("&");

/**
 * A URL that is safe to write to the log. Signed download links, `nxm://` links and upload
 * targets carry their credential in the query, so the values there are redacted unless they
 * are plainly harmless; a fragment is treated the same way and `user:password@` is dropped.
 *
 * Scheme, host, path and the parameter names are kept, as are numeric values, so a log line
 * still shows which link it was and when it expires.
 */
export function redactUrlForLog(url: string | URL): string {
  const text = url.toString();
  const hashAt = text.indexOf("#");
  const beforeHash = hashAt === -1 ? text : text.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const base = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);

  let out = base.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, `$1${REDACTED}@`);
  if (queryAt !== -1) out += `?${redactParams(beforeHash.slice(queryAt + 1))}`;
  if (hashAt !== -1) out += `#${redactParams(text.slice(hashAt + 1))}`;
  return out;
}

/** A URL in free text: scheme, then everything up to whitespace or a quote. */
const URL_IN_TEXT_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>`]+/gi;

/** {@link redactUrlForLog} for every URL in a piece of text, such as a command line. */
export function redactUrlsInText(text: string): string {
  return text.replace(URL_IN_TEXT_RE, (url) => redactUrlForLog(url));
}
