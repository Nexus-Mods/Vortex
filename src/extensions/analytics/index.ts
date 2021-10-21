import { IExtensionContext } from '../../types/IExtensionContext';
import { relaunch } from '../../util/commandLine';
import { truthy } from '../../util/util';
import Analytics from './Analytics';
import settingsReducer from './reducers/settings.reducer';

function init(context: IExtensionContext): boolean {
  context.registerReducer(['settings', 'analytics'], settingsReducer);
  // context.registerSettings('Vortex', SettingsUpdate); // TODO, Write settings

  context.once(() => {
    const instanceId = context.api.store.getState().app.instanceId;
    const enabled = () => context.api.store.getState().settings.analytics.enabled;
    const userInfo = () => context.api.store.getState().persistent.nexus.userInfo;

    // check for update when the user changes the analytics, toggle
    context.api.onStateChange(
      ['settings', 'analytics', 'enabled'],
      (oldEnabled: boolean, newEnabled: boolean) => {
        toggleAnalytics(true);
      });

    // Check for user login
    context.api.onStateChange(['persistent', 'nexus', 'userInfo'], (previous, current) => {
      toggleAnalytics(true);
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

    function toggleAnalytics(isUserEvent?) {
      if (enabled() && userInfo() && userInfo().userId) {
        Analytics.setUser(instanceId);
      } else if (isUserEvent && !enabled() || !userInfo()) {
        // tslint:disable-next-line: max-line-length
        // A relaunch is needed to ensure that the analytics is not running when the user disables it
        Analytics.unsetUser();
        // relaunch(); TODO: Implement ME In the UI when the design arrives
      }
    }

    toggleAnalytics();
  });

  return true;
}

export default init;
