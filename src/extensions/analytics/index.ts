import { IExtensionContext } from '../../types/IExtensionContext';
import { truthy } from '../../util/util';
import Analytics from './Analytics';
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
        Analytics.setUser(instanceId);
      } else {
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

    // Check for navigation in the main menu, EG: opening the settings
    // or externally triggered EG: opening the feedback page
    context.api.onStateChange(['session', 'base', 'mainPage'], (previous, current) => {
      Analytics.trackNavigation(current);
    });

    // Check for when the user uses the secondayPageFeature
    context.api.onStateChange(['session', 'base', 'secondaryPage'], (previous, current) => {
      if (truthy(current)) {
        Analytics.trackNavigation(`secondaryPage/${current}`);
      } else {
        Analytics.trackNavigation(`secondaryPageClosed/${previous}`);
      }
    });

    // Check for navigation in the settings tabs
    context.api.onStateChange(['session', 'base', 'settingsPage'], (previous, current) => {
      Analytics.trackNavigation(current);
    });

    // Check for navigation in dialogs
    context.api.onStateChange(['session', 'base', 'visibleDialog'], (previous, current) => {
      if (truthy(current)) {
        Analytics.trackNavigation(`dialog/${current}`);
      }
    });

    // Check for modal opening
    context.api.events.on('show-modal', modalId => {
      Analytics.trackNavigation(`modal/${modalId}`);
    });

    // Extra listener in case I need to set a custom navigation,
    // eg: Custom Modals or custom tabs in the extensions
    context.api.events.on('analytics-track-navigation', pageId => {
      Analytics.trackNavigation(pageId);
    });

    // Extra listener in case I need to set a custom event tracking
    context.api.events.on('analytics-track-event', (category, action, label?, value?) => {
      Analytics.trackEvent(category, action, label, value);
    });

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
            Analytics.setUser(instanceId);
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
      // Notify developer that Analytics is enabled
      // tslint:disable-next-line: no-console
      console.log('Analytics is enabled');
    }
  });

  return true;
}

export default init;
