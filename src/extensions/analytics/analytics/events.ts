import Analytics from '../Analytics';
import { EventListners, StateListners } from '../types';

export const ClickStateListeners: StateListners = [
  {
    path: ['session', 'extensions', 'installed'],
    callback: (previous, current) => {
      const previousCount = Object.keys(previous || []);
      const currentCount = Object.keys(current || []);
      if (previousCount < currentCount) {
        Analytics.trackClickEvent('Extensions', 'Install');
      }
      // else if (previousCount > currentCount) {
      // This "else if" Can't be used to check if an extension is uninstalled because
      // We can't remove extensions at runtime because the'll already have their callbacks
      // and stuff installed all over the application, so when you remove an extension,
      // we only put in a flag for it to be deleted,
    },
  },
  {
    path: ['settings', 'interface', 'profilesVisible'],
    callback: (_, current) => {
      Analytics.trackClickEvent('Dashboard', `Profile management ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'interface', 'deploy'],
    callback: (_, current) => {
      Analytics.trackClickEvent('Settings', `Deploy Mods ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'interface', 'install'],
    callback: (_, current) => {
      Analytics.trackClickEvent('Settings', `Install Mods ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'interface', 'enable'],
    callback: (_, current) => {
      Analytics.trackClickEvent('Settings', `Enable Mods ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'interface', 'start'],
    callback: (_, current) => {
      Analytics.trackClickEvent('Settings', `Run on startup ${current ? 'ON' : 'OFF'}`);
    },
  },
];

export const ClickEventsListeners: EventListners = [
  {
    event: 'activate-game',
    callback: () => {
      Analytics.trackClickEvent('Header', 'Change game');
    },
  },
];
