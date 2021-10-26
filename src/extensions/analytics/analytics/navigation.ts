import { truthy } from '../../../util/util';
import Analytics from '../Analytics';
import { EventListners, StateListners } from '../types';

export const NavigationStateListners: StateListners = [
  {
    // Check for navigation in the main menu, EG: opening the settings
    // or externally triggered EG: opening the feedback page
    path: ['session', 'base', 'mainPage'],
    callback: (previous, current) => {
      Analytics.trackNavigation(current);
    },
  },
  {
    // Check for when the user uses the secondayPageFeature
    path: ['session', 'base', 'secondaryPage'],
    callback: (previous, current) => {
      if (truthy(current)) {
        Analytics.trackNavigation(`secondaryPage/${current}`);
      } // if current is null it means the secondary page got closed
    },
  },
  {
    // Check for navigation in the settings tabs
    path: ['session', 'base', 'settingsPage'],
    callback: (previous, current) => {
      Analytics.trackNavigation(`settings/${current}`);
    },
  },
  {
    // Check for navigation in dialogs
    path: ['session', 'base', 'visibleDialog'],
    callback: (previous, current) => {
      if (truthy(current)) {
        Analytics.trackNavigation(`dialog/${current}`);
      }
    },
  },
];

export const NavigationEventListeners: EventListners = [
  {
    // Check for modal opening
    event: 'show-modal',
    callback: modalId => {
      Analytics.trackNavigation(`modal/${modalId}`);
    },
  },
];
