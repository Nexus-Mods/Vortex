const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Where feedback goes instead of the feedback service, when `VORTEX_FEEDBACK_API_BASE` names a
 * server on this computer (`scripts/mock-feedback-api.mjs`), such as `http://localhost:9878`. The request carries the user's
 * login, so anything that is not a loopback address is ignored.
 */
export function feedbackApiBase(
  value: string | undefined = process.env.VORTEX_FEEDBACK_API_BASE,
): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return undefined;
  }

  return LOOPBACK_HOSTS.has(url.hostname) ? value.replace(/\/+$/, "") : undefined;
}
