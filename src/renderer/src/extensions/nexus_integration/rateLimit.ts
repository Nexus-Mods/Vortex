/**
 * Recognising a rate limit and telling the user about it. Lives here rather than in util.ts
 * because the modules util.ts itself pulls in need it too, and importing back into util.ts
 * would close a cycle.
 */
import { RateLimitError } from "@nexusmods/nexus-api";
import { getErrorStatusCode } from "@vortex/shared";

import type { IExtensionApi } from "../../types/IExtensionContext";

/**
 * Whether the site turned a request away because we're over its rate limit.
 *
 * nexus-api classifies a 429 as a RateLimitError only on the paths that reach its result
 * handler; the rest arrive as a plain HTTPError carrying the status, so check both.
 */
export function isRateLimited(err: unknown): boolean {
  return err instanceof RateLimitError || getErrorStatusCode(err) === 429;
}

/**
 * Tell the user we've been throttled. Every caller shares one notification id, so a burst of
 * rejected requests collapses into a single warning rather than one per feature.
 */
export function notifyRateLimited(api: IExtensionApi): void {
  api.sendNotification({
    id: "nexus-rate-limited",
    type: "warning",
    title: "Rate limited",
    message:
      "Nexus Mods is asking Vortex to slow down, so some information couldn't be loaded. " +
      "Vortex will try again on its own.",
    displayMS: 10000,
  });
}
