import { IExtensionContext } from '../../types/IExtensionContext';
import { getApplication } from '../../util/application';
import { activeGameId, discoveryByGame, gameName } from '../../util/selectors';
import { getGame } from '../gamemode_management/util/getGame';
import { setAnalytics } from './actions/analytics.action';
import Analytics from './analytics/Analytics';
import { EVENTS_EVENT_LISTENERS, EVENTS_STATE_LISTENERS } from './analytics/events';
import { NAVIGATION_EVENT_LISTENERS, NAVIGATION_STATE_LISTENERS } from './analytics/navigation';
import { HELP_ARTICLE } from './constants';
import settingsReducer from './reducers/settings.reducer';
import SettingsAnalytics from './views/SettingsAnalytics';

let ignoreNextAnalyticsStateChange = false;

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'analytics'], settingsReducer);
  context.registerSettings('Vortex', SettingsAnalytics);

  context.once(() => {
    const instanceId = context.api.store.getState().app.instanceId;
    const updateChannel = context.api.store.getState().settings.update.channel;
    const enabled = () => context.api.store.getState().settings.analytics.enabled;
    const userInfo = () => context.api.store.getState().persistent.nexus.userInfo;

    // check for update when the user changes the analytics, toggle
    const analyticsSettings = ['settings', 'analytics', 'enabled'];
    context.api.onStateChange(analyticsSettings, (oldEnabled: boolean, newEnabled: boolean) => {
      if (ignoreNextAnalyticsStateChange) {
        ignoreNextAnalyticsStateChange = false;
        return;
      }
      if (newEnabled) {
        initializeAnalytics();
        Analytics.trackClickEvent('Tracking', 'Allow - Settings');
      } else {
        Analytics.trackClickEvent('Tracking', 'Deny - Settings');
        Analytics.stop();
      }
    });

    // Check for user login
    context.api.onStateChange(['persistent', 'nexus', 'userInfo'], (previous, current) => {
      if (enabled() === undefined && !!current) {
        // If I was not logged it, and the tracking is undefined ask me for the tracking
        showConsentDialog();
      } else if (!current) {
        // If I'm logging out disable tracking
        Analytics.stop();
        context.api.store.dispatch(setAnalytics(undefined));
      }
    });

    // Extra listener in case I need to set a custom navigation,
    // eg: Custom Modals or custom tabs in the extensions
    context.api.events.on('analytics-track-navigation', pageId => {
      Analytics.trackNavigation(pageId);
    });

    // Custom event for event tracking
    context.api.events.on('analytics-track-event', (category, action, label?, value?) => {
      Analytics.trackEvent(category, action, label, value);
    });

    // Custom event for event tracking
    context.api.events.on('analytics-track-click-event', (category, label?, value?) => {
      Analytics.trackClickEvent(category, label, value);
    });

    // Used to ensure a new dimension is set when changing game by restarting the UA tracking
    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'], () => {
      if (Analytics.isUserSet()) {
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
      if (userInfo() === undefined) {
        return;
      }
      const gameId = activeGameId(context.api.store.getState());
      let gameVersion = '';
      if (gameId) {
        gameVersion = await getGame(gameId)
          .getInstalledVersion(discoveryByGame(context.api.store.getState(), gameId));
      }
      const theme = context.api.store.getState().settings.interface.currentTheme;

      Analytics.start(instanceId, updateChannel, {
        vortexVersion: getApplication().version,
        membership: userInfo().isPremium
          ? 'Premium'
          : userInfo().isSupporter
            ? 'Supporter'
            : 'Member',
        gameId,
        gameVersion,
        theme,
      });

      Analytics.trackEvent('Vortex', 'Version', getApplication().version);
    }

    function showConsentDialog() {
      context.api.showDialog('question', 'Diagnostics & usage data',
        {
          bbcode:
            `Help us provide you with the best modding experience possible![br][/br]
          With your permission, Vortex can automatically collect analytics information and send it to our team to help us improve quality and performance.[br][/br]
          This information is sent to our team entirely anonymously and only with your express consent. [url=${HELP_ARTICLE}]More about the data we track.[/url]`,
        },
        [
          { label: 'Deny' },
          { label: 'Allow', default: true },
        ],
      )
        .then(result => {
          if (result.action === 'Allow') {
            initializeAnalytics();
            Analytics.trackClickEvent('Tracking', 'Allow');
            ignoreNextAnalyticsStateChange = true;
            context.api.store.dispatch(setAnalytics(true));
          } else if (result.action === 'Deny') {
            context.api.store.dispatch(setAnalytics(false));
          }
          return Promise.resolve();
        });
    }

    if (enabled() === undefined && !!userInfo()) {
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
