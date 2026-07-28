import { useEffect } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { scheduleMembershipRefresh } from "../membership";

/**
 * Re-read the account's membership whenever Vortex regains focus, while `enabled`.
 *
 * A plan changed in the browser reaches Vortex only when Vortex asks, and regaining focus is the
 * moment the user comes back. Every return asks: the purchase the user just made is the whole point
 * of listening, and no elapsed-time guess can tell that return from any other. The debounce and the
 * logged-out guard belong to the shared scheduler, so this shares one window with every other
 * trigger.
 */
export function useRefreshUserInfoOnFocus(api: IExtensionApi, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const onFocus = () => scheduleMembershipRefresh(api);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [api, enabled]);
}
