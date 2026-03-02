import * as os from "os";
import type { IExtensionContext } from "../../types/IExtensionContext";
import { analyticsLog } from "./utils/analyticsLog";
import { getCPUArch } from "../../util/nativeArch";
import { setAnalytics } from "./actions/analytics.action";
import AnalyticsMixpanel from "./mixpanel/MixpanelAnalytics";
import type { MixpanelEvent } from "./mixpanel/MixpanelEvents";
import {
  AppLaunchedEvent,
  ModsInstallationCompletedEvent,
} from "./mixpanel/MixpanelEvents";
import { HELP_ARTICLE, PRIVACY_POLICY } from "./constants";
import settingsReducer from "./reducers/settings.reducer";
import SettingsAnalytics from "./views/SettingsAnalytics";
import { getErrorMessageOrDefault } from "@vortex/shared";

let ignoreNextAnalyticsStateChange = false;

function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "analytics"], settingsReducer);
  context.registerSettings("Vortex", SettingsAnalytics);

  context.once(() => {
    const enabled = () =>
      context.api.store.getState().settings.analytics.enabled;
    const getUserInfo = () =>
      context.api.store.getState().persistent.nexus.userInfo;

    // check for update when the user changes the analytics, toggle
    const analyticsSettings = ["settings", "analytics", "enabled"];
    context.api.onStateChange(analyticsSettings, (oldState, newState) => {
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
    context.api.onStateChange(
      ["persistent", "nexus", "userInfo"],
      (previous, current) => {
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
      },
    );

    // EVENTS THAT WE NEED TO HUNT DOWN IN CODEBASE
    // 'analytics-track-navigation'
    // 'analytics-track-event'
    // 'analytics-track-event-with-payload'
    // 'analytics-track-click-event'

    // Extra listener in case I need to set a custom navigation,

    // Mixpanel specific event
    context.api.events.on(
      "analytics-track-mixpanel-event",
      (event: MixpanelEvent) => {
        AnalyticsMixpanel.trackEvent(event);
      },
    );

    async function startAnalytics() {
      try {
        const userInfo = getUserInfo();
        if (userInfo === undefined) {
          analyticsLog(
            "warn",
            "Tried to start analytics but user not logged in",
          );
          return;
        }

        const state = context.api.getState();

        // Determine environment for analytics routing
        // Development environment uses dev token, production uses prod token
        const isProduction = process.env.NODE_ENV !== "development";

        AnalyticsMixpanel.start(userInfo, isProduction);

        // Send app_launched event
        AnalyticsMixpanel.trackEvent(
          new AppLaunchedEvent(
            process.platform, // OS platform (e.g., "win32", "darwin", "linux")
            os.release(), // OS version (e.g., "10.0.22000" for Windows 11)
            getCPUArch(), // Architecture (e.g., "x64", "arm64")
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

    async function stopAnalytics() {
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
                .then((result) => {
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
