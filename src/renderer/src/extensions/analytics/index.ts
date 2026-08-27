import * as os from "os";

import { getErrorMessageOrDefault } from "@vortex/shared";

import type { IExtensionContext } from "@/types/IExtensionContext";
import { getCPUArch } from "@/util/nativeArch";

import { activeGameId, activeProfileId } from "../../util/selectors";
import { nexusGamesProm } from "../nexus_integration/util";
import { setAnalytics } from "./actions/analytics.action";
import { HELP_ARTICLE, PRIVACY_POLICY } from "./constants";
import AnalyticsMixpanel from "./mixpanel/MixpanelAnalytics";
import type { MixpanelEvent } from "./mixpanel/MixpanelEvents";
import { AppLaunchedEvent, AppUIModeChangedEvent } from "./mixpanel/MixpanelEvents";
import { numericNexusGameId } from "./mixpanel/numericGameId";
import settingsReducer from "./reducers/settings.reducer";
import { analyticsLog } from "./utils/analyticsLog";
import SettingsAnalytics from "./views/SettingsAnalytics";

let ignoreNextAnalyticsStateChange = false;

function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "analytics"], settingsReducer);
  context.registerSettings("Vortex", SettingsAnalytics, undefined, undefined, 110);

  context.once(() => {
    const enabled = () => context.api.store.getState().settings.analytics.enabled;
    const getUserInfo = () => context.api.store.getState().persistent.nexus.userInfo;
    // `?? true` because state persisted before the setting existed has no value for it.
    const isLegacyUI = () => !(context.api.getState().settings.window.useModernLayout ?? true);

    // check for update when the user changes the analytics, toggle
    const analyticsSettings = ["settings", "analytics", "enabled"];
    context.api.onStateChange(analyticsSettings, (_, newState) => {
      if (ignoreNextAnalyticsStateChange) {
        ignoreNextAnalyticsStateChange = false;
        return;
      }

      if (newState) {
        startAnalytics();
      } else {
        stopAnalytics();
      }
    });

    // Check for user login
    context.api.onStateChange(["persistent", "nexus", "userInfo"], (_, current) => {
      //showConsentDialog();

      if (enabled() && current) {
        // If the setting is set to true, and I just logged in, skip the Dialog and just turn on Analytics
        startAnalytics();
      } else if (enabled() === undefined && !!current) {
        // If I was not logged it, and the tracking is undefined ask me for the tracking
        showConsentDialog();
      } else if (!current) {
        // If logging out, disable tracking
        stopAnalytics();
      }
    });

    // EVENTS THAT WE NEED TO HUNT DOWN IN CODEBASE
    // 'analytics-track-navigation'
    // 'analytics-track-event'
    // 'analytics-track-event-with-payload'
    // 'analytics-track-click-event'

    // Extra listener in case I need to set a custom navigation,

    // Mixpanel specific event
    context.api.events.on("analytics-track-mixpanel-event", (event: MixpanelEvent) => {
      AnalyticsMixpanel.trackEvent(event);
    });

    // Emitted by the Settings > Theme toggle. Driven by the user action rather than a
    // state listener, because the 2.0 migration writes the same setting during startup
    // and would otherwise report itself as a switch the user never made.
    context.api.events.on("analytics-track-ui-mode-changed", (isLegacy: boolean) => {
      AnalyticsMixpanel.trackEvent(new AppUIModeChangedEvent({ is_legacy_ui: isLegacy }));
    });

    // Keep the active-game super properties in sync so every event carries game scope.
    // Fires on game switch (each game has its own active profile) and profile switch;
    // re-registering the same game is idempotent.
    context.api.onStateChange(["settings", "profiles", "activeProfileId"], () => {
      updateGameContext();
    });

    // Retry once: covers analytics starting before the Nexus games cache has loaded.
    let retriedGameContext = false;

    const updateGameContext = () => {
      const state = context.api.getState();
      const gameId = activeGameId(state);
      const profileId = activeProfileId(state);

      if (!gameId || !profileId) {
        // No active game (e.g. games dashboard) — clear so stale scope can't leak.
        AnalyticsMixpanel.setGameContext(null);
        return;
      }

      const numericGameId = numericNexusGameId(gameId);
      AnalyticsMixpanel.setGameContext({ gameId: numericGameId, profileId });

      if (numericGameId === null && !retriedGameContext) {
        retriedGameContext = true;
        void nexusGamesProm().then(() => updateGameContext());
      }
    };

    function startAnalytics() {
      if (AnalyticsMixpanel.isUserSet()) {
        return;
      }

      try {
        const userInfo = getUserInfo();

        if (userInfo === undefined) {
          analyticsLog("warn", "Tried to start analytics but user not logged in");
          return;
        }

        // Determine environment for analytics routing
        // Development environment uses dev token, production uses prod token
        const isProduction = process.env.NODE_ENV !== "development";

        AnalyticsMixpanel.start(userInfo, isProduction);

        // Register game scope before the first event so app_launched carries the
        // current game (and clears any stale value persisted from a previous session).
        updateGameContext();

        // Send app_launched event
        AnalyticsMixpanel.trackEvent(
          new AppLaunchedEvent(
            process.platform, // OS platform (e.g., "win32", "darwin", "linux")
            os.release(), // OS version (e.g., "10.0.22000" for Windows 11)
            getCPUArch(), // Architecture (e.g., "x64", "arm64")
            isLegacyUI(), // UI mode (true when running the legacy/classic UI)
            context.api.getState().settings.update.channel, // population for the update funnel
          ),
        );

        analyticsLog("info", "Analytics started");
      } catch (err) {
        // there is no error handling anywhere invoking initializeAnalytics,
        // the results aren't even adviced, so any unhandled exception here would
        // crash the application.
        analyticsLog("warn", "Failed to start analytics", {
          error: getErrorMessageOrDefault(err),
        });
      }
    }

    function stopAnalytics() {
      AnalyticsMixpanel.stop();
      analyticsLog("info", "Analytics stopped");
    }

    function showConsentDialog() {
      context.api.sendNotification({
        id: "vortex-analytics-consent",
        type: "info",
        title: "Help us improve your modding experience",
        message: "Find out more about how your data helps us improve",
        actions: [
          {
            title: "More",
            action: (dismiss) => {
              context.api
                .showDialog(
                  "question",
                  "Help us improve your modding experience",
                  {
                    bbcode:
                      "With your permission, we will collect analytics information and send it to our team to help us improve quality and performance. This information is sent anonymously and will never be shared with a 3rd party." +
                      "[br][/br][br][/br][url={{help-article}}]More about the data we track[/url] | [url={{privacy-policy}}]Privacy Policy[/url]",
                    parameters: {
                      "help-article": HELP_ARTICLE,
                      "privacy-policy": PRIVACY_POLICY,
                    },
                  },
                  [
                    {
                      label: "No, don’t share data",
                      action: () => {
                        context.api.store.dispatch(setAnalytics(false));
                      },
                    },
                    {
                      label: "Yes, share anonymous data",
                      action: () => {
                        startAnalytics();
                        ignoreNextAnalyticsStateChange = true;
                        context.api.store.dispatch(setAnalytics(true));
                      },
                      default: true,
                    },
                  ],
                )
                .then(() => {
                  dismiss();
                  return Promise.resolve();
                });
            },
          },
        ],
      });
    }

    if (enabled() === undefined && !!getUserInfo()) {
      // Is logged in, show consent dialog
      showConsentDialog();
    }

    if (enabled()) {
      startAnalytics();
    }
  });

  return true;
}

export default init;
