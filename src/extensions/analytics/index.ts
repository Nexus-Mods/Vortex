import * as semver from 'semver';
import { IExtensionContext } from '../../types/IExtensionContext';
import { getApplication } from '../../util/application';
import { analyticsLog } from './utils/analyticsLog';
import { setAnalytics } from './actions/analytics.action';
import AnalyticsMixpanel from './mixpanel/MixpanelAnalytics';
import { AppCrashedEvent, AppLaunchedEvent, MixpanelEvent, ModsInstallationCompletedEvent } from './mixpanel/MixpanelEvents';
import { HELP_ARTICLE, PRIVACY_POLICY } from './constants';
import settingsReducer from './reducers/settings.reducer';
import SettingsAnalytics from './views/SettingsAnalytics';

let ignoreNextAnalyticsStateChange = false;

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'analytics'], settingsReducer);
  context.registerSettings('Vortex', SettingsAnalytics);

  context.once(() => {

    // Capture uncaught exceptions
    process.on('uncaughtException', (err: any) => {
      try {
        if (enabled() && AnalyticsMixpanel.isUserSet()) {
          AnalyticsMixpanel.trackEvent(new AppCrashedEvent(
            process.platform,
            err.code || 'unknown',
            err.message || 'Unknown uncaught exception'
          ));
        }
        analyticsLog('error', 'Uncaught exception', { error: err.message, code: err.code, stack: err.stack });
      } catch (trackingError) {
        // Don't let analytics tracking cause additional crashes
        console.error('Failed to track crash event:', trackingError);
      }
      // Note: Process will still terminate unless you handle it differently
    });

    // Capture unhandled rejections
    process.on('unhandledRejection', (err: any) => {
      try {
        if (enabled() && AnalyticsMixpanel.isUserSet()) {
          AnalyticsMixpanel.trackEvent(new AppCrashedEvent(
            process.platform,
            err.code || 'unknown',
            err.message || 'Unknown unhandled rejection'
          ));
        }
        analyticsLog('error', 'Unhandled rejection', { error: err.message, code: err.code, stack: err.stack });
      } catch (trackingError) {
        // Don't let analytics tracking cause additional crashes
        console.error('Failed to track crash event:', trackingError);
      }
      // Note: Process will still terminate unless you handle it differently
    });

    const instanceId = context.api.store.getState().app.instanceId;
    const updateChannel = context.api.store.getState().settings.update.channel;
    const enabled = () => context.api.store.getState().settings.analytics.enabled;
    const getUserInfo = () => context.api.store.getState().persistent.nexus.userInfo;

    // check for update when the user changes the analytics, toggle
    const analyticsSettings = ['settings', 'analytics', 'enabled'];
    context.api.onStateChange(analyticsSettings, (oldState, newState) => {

      if (ignoreNextAnalyticsStateChange) {
        ignoreNextAnalyticsStateChange = false;
        return;
      }
      if (newState) {
        initializeAnalytics();
      } else {
        AnalyticsMixpanel.stop();
      }
    });

    // Check for user login
    context.api.onStateChange(['persistent', 'nexus', 'userInfo'], (previous, current) => {

      if (enabled() && current) {
        // If the setting is set to true, and I just logged in, skip the Dialog and just turn on Analytics
        initializeAnalytics()
      } else if (enabled() === undefined && !!current) {
        // If I was not logged it, and the tracking is undefined ask me for the tracking
        showConsentDialog();
      } else if (!current) {
        // If logging out, disable tracking
        AnalyticsMixpanel.stop();
      }
    });

    // EVENTS THAT WE NEED TO HUNT DOWN IN CODEBASE
    // 'analytics-track-navigation'
    // 'analytics-track-event'
    // 'analytics-track-event-with-payload'
    // 'analytics-track-click-event'

    // Extra listener in case I need to set a custom navigation,

    // Mixpanel specific event
    context.api.events.on('analytics-track-mixpanel-event', (event: MixpanelEvent) => {
      AnalyticsMixpanel.trackEvent(event);
    });

    async function initializeAnalytics() {

      try {
        const userInfo = getUserInfo();
        if (userInfo === undefined) {
          return;
        }

        const state = context.api.getState();

        // Determine if this is a stable version for analytics routing
        const appVersion = getApplication().version;
        const parsedVersion = semver.parse(appVersion);
        const isStable = parsedVersion &&
          !parsedVersion.prerelease.length &&
          appVersion !== '0.0.1' &&
          process.env.NODE_ENV !== 'development';

        AnalyticsMixpanel.start(userInfo, isStable);

        // Send app_launched event
        AnalyticsMixpanel.trackEvent(new AppLaunchedEvent(
          process.platform
        ));

        analyticsLog('info', 'Analytics initialized');

      } catch (err) {
        // there is no error handling anywhere invoking initializeAnalytics,
        // the results aren't even adviced, so any unhandled exception here would
        // crash the application.
        analyticsLog('warn', 'Failed to initialize analytics', { error: err.message });
      }
    }

    function showConsentDialog() {
      context.api.sendNotification({
        id: 'vortex-analytics-consent',
        type: 'info',
        title: 'Help us improve your modding experience',
        message: 'Find out more about how your data helps us improve',
        actions: [
          {
            title: 'More', action: dismiss => {
              context.api.showDialog('question', 'Help us improve your modding experience', {
                bbcode:
                  'With your permission, we will collect analytics information and send it to our team to help us improve quality and performance. This information is sent anonymously and will never be shared with a 3rd party.'
                  + '[br][/br][br][/br][url={{help-article}}]More about the data we track.[/url] | [url={{privacy-policy}}]Privacy Policy[/url]',
                parameters: {
                  'help-article': HELP_ARTICLE,
                  'privacy-policy': PRIVACY_POLICY,
                }
              }, [
                {
                  label: 'No, don’t share data', action: () => {
                    context.api.store.dispatch(setAnalytics(false));
                  }
                },
                {
                  label: 'Yes, share anonymous data', action: () => {
                    initializeAnalytics();
                    ignoreNextAnalyticsStateChange = true;
                    context.api.store.dispatch(setAnalytics(true));
                  }, default: true
                },
              ])
                .then(result => {
                  dismiss();
                  return Promise.resolve();
                });
            }
          }
        ],
      });
    }

    if (enabled() === undefined && !!getUserInfo()) {
      // Is logged in, show consent dialog
      showConsentDialog();
    }

    if (enabled()) {
      initializeAnalytics();
    }
  });

  return true;
}

export default init;
