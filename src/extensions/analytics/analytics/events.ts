import AnalyticsUA from './AnalyticsUA';
import { EventListeners, StateListeners } from '../types';

export const EVENTS_STATE_LISTENERS: StateListeners = [
  {
    path: ['session', 'extensions', 'installed'],
    callback: (previous, current) => {
      const previousCount = Object.keys(previous || {}).length;
      const currentCount = Object.keys(current || {}).length;
      if (previousCount < currentCount) {
        AnalyticsUA.trackClickEvent('Extensions', 'Install');
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
      AnalyticsUA.trackClickEvent('Settings', `Profile management ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'automation', 'deploy'],
    callback: (_, current) => {
      AnalyticsUA.trackClickEvent('Settings', `Deploy Mods ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'automation', 'install'],
    callback: (_, current) => {
      AnalyticsUA.trackClickEvent('Settings', `Install Mods ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'automation', 'enable'],
    callback: (_, current) => {
      AnalyticsUA.trackClickEvent('Settings', `Enable Mods ${current ? 'ON' : 'OFF'}`);
    },
  },
  {
    path: ['settings', 'automation', 'start'],
    callback: (_, current) => {
      AnalyticsUA.trackClickEvent('Settings', `Run on startup ${current ? 'ON' : 'OFF'}`);
    },
  },
];

export const EVENTS_EVENT_LISTENERS: EventListeners = [
  {
    event: 'activate-game',
    callback: () => {
      AnalyticsUA.trackClickEvent('Header', 'Change game');
    },
  },
];
