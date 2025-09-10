import { contextType } from 'react-bootstrap/lib/Accordion';
import * as semver from 'semver';
import { IExtensionContext } from '../../types/IExtensionContext';
import { getApplication } from '../../util/application';
import { analyticsLog } from './utils/analyticsLog';
import { activeGameId, discoveryByGame } from '../../util/selectors';
import { getGame } from '../gamemode_management/util/getGame';
import { setAnalytics } from './actions/analytics.action';
import AnalyticsUA, { DIMENSIONS } from './analytics/AnalyticsUA';
import AnalyticsGA4 from './analytics/AnalyticsGA4';
import AnalyticsMixpanel from './mixpanel/MixpanelAnalytics';
import { AppCrashedEvent, AppLaunchedEvent, MixpanelEvent, ModsInstallationCompletedEvent } from './mixpanel/MixpanelEvents';
import { EVENTS_EVENT_LISTENERS, EVENTS_STATE_LISTENERS } from './analytics/events';
import { NAVIGATION_EVENT_LISTENERS, NAVIGATION_STATE_LISTENERS } from './analytics/navigation';
import { HELP_ARTICLE } from './constants';
import settingsReducer from './reducers/settings.reducer';
import SettingsAnalytics from './views/SettingsAnalytics';
import { IMod } from '@nexusmods/nexus-api/lib/types';
import metrics from './analytics/Metrics';

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
        AnalyticsUA.trackClickEvent('Tracking', 'Allow - Settings');
        AnalyticsGA4.stop();
      } else {
        AnalyticsUA.trackClickEvent('Tracking', 'Deny - Settings');
        AnalyticsUA.stop();
        AnalyticsMixpanel.stop();
      }
    });





    // new settings events

    // register settings tracking event when analytics is changed
    context.api.onStateChange(['settings', 'analytics', 'enabled'], (oldState, newState) => {
      AnalyticsGA4.trackSettingsEvent('Analytics', newState);
    });

    // register settings tracking event when language is changed
    context.api.onStateChange(['settings', 'interface', 'language'], (oldState, newState) => {
      AnalyticsGA4.setUserProperty('Language', newState);
      AnalyticsGA4.trackSettingsEvent('Language', newState);
    });

    // register settings tracking event when theme is changed
    context.api.onStateChange(['settings', 'interface', 'currentTheme'], (oldState, newState) => {
      AnalyticsGA4.setUserProperty('Theme', newState);
      AnalyticsGA4.trackSettingsEvent('Theme', newState);
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
        // If I'm logging out disable tracking
        AnalyticsUA.stop();
        AnalyticsGA4.stop();
        AnalyticsMixpanel.stop();
      }
    });

    // Extra listener in case I need to set a custom navigation,
    // eg: Custom Modals or custom tabs in the extensions
    context.api.events.on('analytics-track-navigation', pageId => {
      AnalyticsUA.trackNavigation(pageId);
      AnalyticsGA4.trackPageView(pageId);
      metrics.trackEvent('Navigation', {pageId});
    });



    // Mixpanel specific event
    context.api.events.on('analytics-track-mixpanel-event', (event: MixpanelEvent) => {
      AnalyticsMixpanel.trackEvent(event);
    });
  


    // Custom event for event tracking
    context.api.events.on('analytics-track-event', (category, action, label?, value?) => {
      AnalyticsUA.trackEvent(category, action, label, value);
      AnalyticsGA4.trackEvent(action.toLocaleLowerCase(), category, label, value);
      metrics.trackEvent(action.toLocaleLowerCase(), {category, label, value});
    });

    // Custom event for event tracking (with raw payload)
    context.api.events.on('analytics-track-event-with-payload', (action, payload) => {
      AnalyticsGA4.trackEventWithRawPayload(action.toLocaleLowerCase(), payload);
      metrics.trackEvent(action.toLocaleLowerCase(), payload);
    });

    // Custom event for event tracking
    context.api.events.on('analytics-track-click-event', (category, label?, value?) => {
      AnalyticsUA.trackClickEvent(category, label, value);
      AnalyticsGA4.trackClickEvent(category, label, value);
      metrics.trackEvent('Click', {category, label, value});
    });

    // Used to ensure a new dimension is set when changing game by restarting the UA tracking
    // Don't need this for GA4
    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'], () => {
      if (AnalyticsUA.isUserSet()) {
        initializeAnalytics();
      }
    });

    // All state listeners
    const stateListners = [
      ...NAVIGATION_STATE_LISTENERS,
      ...EVENTS_STATE_LISTENERS,
    ];
    for (const stateListner of stateListners) {
      context.api.onStateChange(stateListner.path, stateListner.callback);
    }

    // All event listeners
    const eventListners = [
      ...NAVIGATION_EVENT_LISTENERS,
      ...EVENTS_EVENT_LISTENERS,
    ];
    for (const eventListner of eventListners) {
      context.api.events.on(eventListner.event, eventListner.callback);
    }

    async function initializeAnalytics() {

      try {
        const userInfo = getUserInfo();
        if (userInfo === undefined) {
          return;
        }

        const state = context.api.getState();

        const gameId = activeGameId(state);
        let gameVersion = '';
        let extensionVersion = '';
        let gameProfileCount = 0;

        if (gameId) {
          const game = getGame(gameId);          
          extensionVersion = game.version;
          gameVersion = await game.getInstalledVersion(discoveryByGame(state, gameId));
          gameProfileCount = Object.values(state.persistent.profiles).filter((profile) => { return profile.gameId === gameId }).length;         
        }

        const theme = state.settings.interface['currentTheme'];
        const language = state.settings.interface['language'];

        // Determine if this is a stable version for analytics routing
        const appVersion = getApplication().version;
        const parsedVersion = semver.parse(appVersion);
        const isStable = parsedVersion && 
                        !parsedVersion.prerelease.length &&
                        appVersion !== '0.0.1' &&
                        process.env.NODE_ENV !== 'development';

        /**
        * don't need now that we are forcing users to relogin if older than a certain version
        * 
        const apiKey = state.confidential.account?.['nexus']?.['APIKey'];
        const oauthCred = state.confidential.account?.['nexus']?.['OAuthCredentials'];
        log('info', 'initializeAnalytics()', { apiKey: apiKey !== undefined, oauthCred: oauthCred !== undefined });

        const authType = oauthCred !== undefined ? 'oauth' : (apiKey !== undefined ? 'apikey' : 'none');
        */

        const allGameAndMods = state.persistent.mods;

        const gameCount = Object.keys(allGameAndMods).length;

        // reduces array of mods per game into a large array of all mod ids
        const allModsAndCollections = Object.values(allGameAndMods).reduce(
          (accumulator, current) => accumulator.concat(Object.values(current)), []); 

        const collectionCount = allModsAndCollections.filter((mod) => { return mod.type === 'collection'}).length;
        const modCount = allModsAndCollections.filter((mod) => { return mod.type !== 'collection'}).length;

        const membership = userInfo.isPremium
          ? 'Premium'
          : userInfo.isSupporter
            ? 'Supporter'
            : 'Member';       

        const userProperties = {
          ["VortexVersion"]: getApplication().version,
          ["Membership"]: membership,
          ["Game"]: gameId,
          ["GameVersion"]: gameVersion,
          ["GameExtensionVersion"]: extensionVersion,
          ["Theme"]: theme,
          ["Sandbox"]: state.settings.mods['installerSandbox'] ?? true,
          ["ModCount"]: modCount,
          ["CollectionCount"]: collectionCount,
          ["GameCount"]: gameCount,
          ["Language"]: language,
          ["GameProfileCount"]: gameProfileCount,
        };

        AnalyticsGA4.start(instanceId, updateChannel, userProperties);
        
        AnalyticsUA.start(instanceId, updateChannel, {
          [DIMENSIONS.VortexVersion]: getApplication().version,
          [DIMENSIONS.Membership]: membership,
          [DIMENSIONS.Game]: gameId,
          [DIMENSIONS.GameVersion]: gameVersion,
          [DIMENSIONS.Theme]: theme,
          [DIMENSIONS.Sandbox]: state.settings.mods['installerSandbox'] ?? true,
        });

        AnalyticsMixpanel.start(userInfo, isStable);

        // Send app_launched event
        AnalyticsMixpanel.trackEvent(new AppLaunchedEvent(
          process.platform
        ));

        // send some more events to the new metrics system
        AnalyticsMixpanel.trackEvent(new AppCrashedEvent(
          process.platform,
          '12345', // error code - not available yet
          'Simon\'s invented error'   // error message - not available yet
        ));

        metrics.start(instanceId, getApplication().version, context.api);
        
        analyticsLog('info', 'Analytics initialized');
        analyticsLog('debug', `User properties for channel: ${updateChannel}`, userProperties); 

        AnalyticsUA.trackEvent('Vortex', 'Version', getApplication().version);

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
        title: 'Diagnostics & Usage Data',
        message: 'Find out more about how we use diagnostic and usage data',
        actions: [
          {
            title: 'More', action: dismiss => {
              context.api.showDialog('question', 'Diagnostics & usage data', {
                bbcode:
                  'Help us provide you with the best modding experience possible![br][/br]'
                  + 'With your permission, Vortex can automatically collect '
                  + 'analytics information and send it to our team to help us improve quality and performance.[br][/br]'
                  + 'This information is sent to our team entirely anonymously and only with your express consent. '
                  + '[url={{url}}]More about the data we track.[/url]',
                parameters: {
                  url: HELP_ARTICLE,
                }
              }, [
                { label: 'Deny' },
                { label: 'Allow', default: true },
              ])
                .then(result => {
                  dismiss();
                  if (result.action === 'Allow') {
                    initializeAnalytics();
                    AnalyticsUA.trackClickEvent('Tracking', 'Allow');
                    AnalyticsGA4.trackClickEvent('Tracking', 'Allow');
                    ignoreNextAnalyticsStateChange = true;
                    context.api.store.dispatch(setAnalytics(true));
                  } else if (result.action === 'Deny') {
                    context.api.store.dispatch(setAnalytics(false));
                  }
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
