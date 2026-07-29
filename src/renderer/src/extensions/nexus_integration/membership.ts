/**
 * Nothing on the website pushes a membership change to Vortex, so every read of
 * `persistent.nexus.userInfo` is potentially stale. This module is the one place that decides when
 * to go and ask again, so the triggers scattered across the UI share a single request.
 */
import type Nexus from "@nexusmods/nexus-api";

import type { IExtensionApi } from "../../types/IExtensionContext";
import Debouncer from "../../util/Debouncer";
import { REVALIDATION_FREQUENCY } from "./constants";
import { isLoggedIn, userInfo } from "./selectors";
import { getUserInfo } from "./util";

/** Collapses the focus / hover / menu triggers, which all mean "the user might have changed plan". */
const REFRESH_DEBOUNCE = 3000;

/** How long a failed read holds off the next attempt, so an unreachable api isn't hammered. */
const FAILURE_COOLDOWN = 30 * 1000;

/**
 * Floor for hovering a collection, which fires on mouse movement alone. The install path confirms
 * the membership before it refuses anything, so the read a hover asks for is speculative and the
 * background revalidation cadence is enough for it.
 */
export const HOVER_REFRESH_FLOOR = REVALIDATION_FREQUENCY;

let lastRead = 0;
let lastReadFailed = false;
let inFlight: Promise<boolean> | undefined;

/**
 * Whether the last read still stands. A read that failed stands for the shorter cooldown, so an
 * unreachable api isn't hammered without `lastRead` having to misreport when it last answered.
 */
function readIsRecent(
  within = lastReadFailed ? FAILURE_COOLDOWN : REVALIDATION_FREQUENCY,
): boolean {
  return Date.now() - lastRead < within;
}

/**
 * Count a write of `userInfo` from outside this module as a read - the api-key revalidation and the
 * login token refresh both write it directly. Registered once, from the extension's init.
 *
 * Watches the store rather than going through `api.onStateChange`, which reports a change only
 * when the new value differs (ReduxWatcher compares deeply). A read that confirms the membership
 * is unchanged writes an equal value, and that is precisely the read worth remembering: without it
 * the next refusal pays for a round trip whose answer is already in state.
 */
export function trackMembershipReads(api: IExtensionApi): void {
  let last = userInfo(api.getState());
  api.store.subscribe(() => {
    const current = userInfo(api.getState());
    if (current === last) {
      return;
    }
    last = current;
    lastRead = Date.now();
  });
}

/** Re-read the membership now. Concurrent callers share the one request. */
export async function refreshMembership(api: IExtensionApi, nexus: Nexus): Promise<boolean> {
  if (inFlight !== undefined) {
    return inFlight;
  }
  inFlight = Promise.resolve(getUserInfo(api, nexus))
    .then((updated) => {
      // a failure counts as an attempt, and stands for the shorter cooldown
      lastRead = Date.now();
      lastReadFailed = updated !== true;
      return updated === true;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/**
 * Re-read the membership unless it was read recently. For the checks that refuse the user
 * something on the strength of the cached flag, so a plan change made on the website doesn't keep
 * costing them for the rest of the session.
 */
export async function ensureFreshMembership(api: IExtensionApi, nexus: Nexus): Promise<void> {
  if (!isLoggedIn(api.getState()) || readIsRecent()) {
    return;
  }
  await refreshMembership(api, nexus);
}

const refreshDebouncer = new Debouncer(
  (api: IExtensionApi) => {
    // a logged-out user has no membership to read, and asking anyway raises an error toast
    if (isLoggedIn(api.getState())) {
      api.events.emit("refresh-user-info");
    }
    return null;
  },
  REFRESH_DEBOUNCE,
  false,
  true,
);

/**
 * Ask for a re-read without waiting for it, for the triggers that only want the UI to catch up:
 * regaining focus, hovering a collection, the Refresh User Info menu item, an nxm://premium link.
 *
 * A trigger that fires on its own passes `notReadWithin` to drop the request while a read that
 * recent already answers it, because the debounce alone still lets one through every few seconds for
 * as long as the trigger keeps firing. A trigger the user set off deliberately passes nothing and
 * always asks.
 */
export function scheduleMembershipRefresh(api: IExtensionApi, notReadWithin = 0): void {
  if (readIsRecent(notReadWithin)) {
    return;
  }
  refreshDebouncer.schedule(undefined, api);
}

/** Test seam: forget when the membership was last read, and re-arm the debounce. */
export function resetMembershipFreshness(): void {
  lastRead = 0;
  lastReadFailed = false;
  refreshDebouncer.clear();
}
