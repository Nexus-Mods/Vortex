import { useEffect } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import Debouncer from "@/util/Debouncer";

/**
 * Shared by every premium surface in the health check, so several armed at once (an
 * open upsell modal plus the page banner) still cost one request, and re-opening the
 * upsell doesn't re-request. Nexus rate limits, and this fires on window focus.
 */
const refreshDebouncer = new Debouncer(
  (emit: () => void) => {
    emit();

    return Promise.resolve();
  },
  10000,
  false,
  true,
);

/**
 * While `armed`, re-check the user's membership whenever the window regains focus.
 *
 * Arm this after sending someone to the premium page: they buy in the browser and
 * alt-tab back, and nothing tells Vortex about it — it has to ask. Until something
 * refreshes `persistent.nexus.userInfo` the health check still believes they're a free
 * user, so it keeps the premium badge on the install buttons and re-opens the upsell
 * instead of installing. The collections upsell already works this way, see
 * FreeUserDLDialog.
 *
 * Whether we're logged in at all is checked by the `refresh-user-info` handler.
 */
export const usePremiumStatusRefresh = (api: IExtensionApi, armed: boolean): void => {
  useEffect(() => {
    if (!armed) {
      return;
    }

    const refresh = () =>
      refreshDebouncer.schedule(undefined, () => api.events.emit("refresh-user-info"));

    window.addEventListener("focus", refresh);

    return () => window.removeEventListener("focus", refresh);
  }, [api, armed]);
};
