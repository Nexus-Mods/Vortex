import { truthy } from '../../../util/util';
import AnalyticsUA from './AnalyticsUA';
import { EventListeners, StateListeners } from '../types';
import AnalyticsGA4 from './AnalyticsGA4';

export const NAVIGATION_STATE_LISTENERS: StateListeners = [
  {
    // Check for navigation in the main menu, EG: opening the settings
    // or externally triggered EG: opening the feedback page
    path: ['session', 'base', 'mainPage'],
    callback: (previous, current) => {
      AnalyticsUA.trackNavigation(current);
      AnalyticsGA4.trackPageView(current);
    },
  },
  {
    // Check for when the user uses the secondayPageFeature
    path: ['session', 'base', 'secondaryPage'],
    callback: (previous, current) => {
      if (truthy(current)) {
        AnalyticsUA.trackNavigation(`secondaryPage/${current}`);
        AnalyticsGA4.trackPageView(`secondaryPage/${current}`);
      } // if current is null it means the secondary page got closed
    },
  },
  {
    // Check for navigation in the settings tabs
    path: ['session', 'base', 'settingsPage'],
    callback: (previous, current) => {
      AnalyticsUA.trackNavigation(`settings/${current}`);
      AnalyticsGA4.trackPageView(`settings/${current}`);
    },
  },
  {
    // Check for navigation in dialogs
    path: ['session', 'base', 'visibleDialog'],
    callback: (previous, current) => {
      if (truthy(current)) {
        AnalyticsUA.trackNavigation(`dialog/${current}`);
        AnalyticsGA4.trackPageView(`dialog/${current}`);
      }
    },
  },
];

export const NAVIGATION_EVENT_LISTENERS: EventListeners = [
  {
    // Check for modal opening
    event: 'show-modal',
    callback: modalId => {
      AnalyticsUA.trackNavigation(`modal/${modalId}`);
      AnalyticsGA4.trackPageView(`modal/${modalId}`);
    },
  },
];
