import { IExtensionContext } from '../../types/IExtensionContext';
import { getApplication } from '../../util/application';
import Analytics from './Analytics';
import { ClickEventsListeners, ClickStateListeners } from './analytics/events';
import { NavigationEventListeners, NavigationStateListners } from './analytics/navigation';
import { setAnalytics } from './reducers/analytics.action';
import settingsReducer from './reducers/settings.reducer';
import SettingsAnalytics from './views/SettingsAnalytics';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'analytics'], settingsReducer);
  context.registerSettings('Vortex', SettingsAnalytics);

  context.once(() => {
    const instanceId = context.api.store.getState().app.instanceId;
    const enabled = () => context.api.store.getState().settings.analytics.enabled;
    const userInfo = () => context.api.store.getState().persistent.nexus.userInfo;

    // check for update when the user changes the analytics, toggle
    const analyticsSettings = ['settings', 'analytics', 'enabled'];
    context.api.onStateChange(analyticsSettings, (oldEnabled: boolean, newEnabled: boolean) => {
      if (newEnabled) {
        initializeAnalytics();
        setTimeout(() => {
          Analytics.trackClickEvent('Tracking', 'Allow - Settings');
        }, 500);
      } else {
        Analytics.trackClickEvent('Tracking', 'Deny - Settings');
        Analytics.unsetUser();
      }
    });

    // Check for user login
    context.api.onStateChange(['persistent', 'nexus', 'userInfo'], (previous, current) => {
      if (enabled() === undefined && !!current) {
        // If I was not logged it, and the tracking is undefined ask me for the tracking
        showConsentDialog();
      } else if (!current) {
        // If I'm logging out disable tracking
        Analytics.unsetUser();
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

    // All state listeners
    const stateListners = [...NavigationStateListners, ...ClickStateListeners];
    for (const stateListner of stateListners) {
      context.api.onStateChange(stateListner.path, stateListner.callback);
    }

    // All event listeners
    const eventListners = [...NavigationEventListeners, ...ClickEventsListeners];
    for (const eventListner of eventListners) {
      context.api.events.on(eventListner.event, eventListner.callback);
    }

    function initializeAnalytics() {
      Analytics.setUser(instanceId);
      Analytics.trackEvent('Vortex', 'Version', getApplication().version);
    }

    function showConsentDialog() {
      context.api.showDialog('question', 'Diagnostics & usage data',
        {
          bbcode:
            `Help us provide you with the best modding experience possible![br][/br]
          With your permission, Vortex can automatically collect analytics information and send it to our team to help us improve quality and performance.[br][/br]
          This information is sent to our team entirely anonymously and only with your express consent. [url=https://help.nexusmods.com/article/121-diagnostics-usage-data-vortex]More about the data we track.[/url]`,
        },
        [
          { label: 'Deny' },
          { label: 'Allow', default: true },
        ],
      )
        .then(result => {
          if (result.action === 'Allow') {
            initializeAnalytics();
            context.api.store.dispatch(setAnalytics(true));
            setTimeout(() => {
              Analytics.trackClickEvent('Tracking', 'Allow');
            }, 500);
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
