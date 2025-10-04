import { IExtensionApi } from '../types/IExtensionContext';
import { INotification } from '../types/INotification';
import { IState } from '../types/IState';

import { log } from '../util/log';
import getVortexPath from './getVortexPath';

import * as path from 'path';
import * as remote from '@electron/remote';

class GlobalNotifications {
  private mCurrentId: string;
  private mCurrentNotification: Electron.Notification;
  private mKnownNotifications: INotification[];
  private mIsEnabled: () => boolean;
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
    api.onStateChange([ 'session', 'notifications', 'global_notifications' ],
                      (oldState, newState) => {
                        this.mKnownNotifications = newState;

                        let currentNotification: INotification;

                        if (this.mCurrentId !== undefined) {
                          currentNotification = this.mKnownNotifications.find(
                            (notification: INotification) => notification.id === this.mCurrentId);
                          if (currentNotification === undefined) {
                            log('debug', 'notification no longer exists', this.mCurrentId);
          // notification no longer exists
                            this.mCurrentId = undefined;
                          }
                        }

      // close notification if it was dismissed
                        if ((this.mCurrentId === undefined) && (this.mCurrentNotification !== undefined)) {
                          log('debug', 'close notification',
                              { id: this.mCurrentId, name: this.mCurrentNotification.body });
                          this.mCurrentNotification.close();
                          this.mCurrentNotification = undefined;
                        } else if ((this.mCurrentNotification !== undefined) &&
                 (currentNotification.message !== this.mCurrentNotification.body)) {
                          log('debug', 'replace notification', { id: this.mCurrentId });
                          this.mCurrentNotification.close();
                          this.mCurrentNotification = undefined;
                          this.showNotification(currentNotification);
                        } else {
                          currentNotification = this.mKnownNotifications[this.mKnownNotifications.length - 1];
                          if ((currentNotification !== undefined)
            && (this.mCurrentId !== currentNotification.id)
            && (this.mIsEnabled())) {
                            log('debug', 'new notification', { id: currentNotification.id });
                            this.showNotification(currentNotification);
                            this.mCurrentId = currentNotification.id;
                          }
                        }
                      });

    const state: IState = api.store.getState();
    this.mIsEnabled = () => state.settings.interface.desktopNotifications;
  }

  private showNotification(notification: INotification): void {
    this.mCurrentId = notification.id;
    try {
      // Ensure Notification is available in renderer via @electron/remote
      if ((remote as any).Notification === undefined
          || (typeof (remote as any).Notification !== 'function')
          || (((remote as any).Notification.isSupported !== undefined)
              && !(remote as any).Notification.isSupported())) {
        throw new Error('Desktop notifications not supported in renderer');
      }
      // Create Electron Notification with macOS-specific styling
      this.mCurrentNotification = new (remote as any).Notification({
        title: notification.title || 'Vortex',
        subtitle: notification.type.charAt(0).toUpperCase() + notification.type.slice(1),
        body: notification.message,
        icon: notification.icon || path.resolve(getVortexPath('assets'), 'images', 'vortex.png'),
        silent: notification.type !== 'error' && notification.type !== 'warning',
        timeoutType: 'never',
        actions: notification.actions ? notification.actions.map(action => ({
          type: 'button',
          text: action.title
        })) : []
      });

      // Handle notification events
      this.mCurrentNotification.on('click', () => {
        // Bring Vortex window to front when notification is clicked
        this.mApi.events.emit('activate-window');
      });

      this.mCurrentNotification.on('close', () => {
        this.mCurrentNotification = undefined;
      });

      // Show the notification
      this.mCurrentNotification.show();
    } catch (err) {
      log('warn', 'failed to show desktop notification', { err: err.message });
      // Fallback to balloon notification
      this.mApi.events.emit('show-balloon', notification.title, notification.message);
    }
  }
}

export default GlobalNotifications;