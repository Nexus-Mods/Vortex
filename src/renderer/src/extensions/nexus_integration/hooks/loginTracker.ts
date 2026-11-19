import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import { isAnalyticsEnabled } from "@/extensions/analytics/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { type LoginPromptCohort, loginPromptCohort } from "../experiments/loginPromptExperiment";

/** Which button started the login; `login_dialog` is the dialog's own, opened by `ensureLoggedIn`. */
export type LoginSource = "startup_prompt" | "header" | "health_check" | "login_dialog";

type LoginCompletedProps = { source: LoginSource; login_prompt_cohort: LoginPromptCohort };

export const createLoginTracker = (api: IExtensionApi) => ({
  trackLoginCompleted: (props: LoginCompletedProps) =>
    api.events.emit("analytics-track-mixpanel-event", {
      eventName: "app_login_completed",
      properties: { ...props },
    } satisfies MixpanelEvent),
});

// Analytics only starts once the account is known, after the login, so the login waits here.
let pending: LoginCompletedProps | undefined;

/**
 * Holds a successful login to send once analytics starts. Only when consent was given before the
 * login: agreeing afterwards doesn't cover it. A later login replaces or clears the held one.
 */
export const noteLoginCompleted = (api: IExtensionApi, source: LoginSource): void => {
  pending = isAnalyticsEnabled(api.getState())
    ? { source, login_prompt_cohort: loginPromptCohort() }
    : undefined;
};

/** Sends the held login, if any, when analytics starts. Call once at startup. */
export const trackLoginsWhenAnalyticsStarts = (api: IExtensionApi): void => {
  const tracker = createLoginTracker(api);
  api.events.on("analytics-started", () => {
    if (pending !== undefined) {
      tracker.trackLoginCompleted(pending);
      pending = undefined;
    }
  });
};
