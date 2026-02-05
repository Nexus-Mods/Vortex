import type { IExtensionApi } from "../types/IExtensionContext";
import type { INotification } from "../types/INotification";
import type { IState } from "../types/IState";

import { log } from "../util/log";
import getVortexPath from "./getVortexPath";

import * as path from "path";

class GlobalNotifications {
  private mCurrentId: string | undefined;
  private mCurrentNotification: any;
  private mKnownNotifications: INotification[];
  private mIsEnabled: () => boolean;

  constructor(api: IExtensionApi) {
    api.onStateChange?.(
      ["session", "notifications", "global_notifications"],
      (oldState, newState) => {
        this.mKnownNotifications = newState;

        let currentNotification: INotification | undefined = undefined;

        if (this.mCurrentId !== undefined) {
          currentNotification = this.mKnownNotifications.find(
            (notification: INotification) =>
              notification.id === this.mCurrentId,
          );
          if (currentNotification === undefined) {
            log("debug", "notification no longer exists", this.mCurrentId);
            // notification no longer exists
            this.mCurrentId = undefined;
          }
        }

        // close notification if it was dismissed
        if (this.mCurrentId === undefined && this.mCurrentNotification) {
          log("debug", "close notification", {
            id: this.mCurrentNotification.tag,
            name: this.mCurrentNotification.body,
          });
          this.mCurrentNotification.close();
          this.mCurrentNotification = undefined;
        } else if (
          this.mCurrentNotification &&
          currentNotification?.message !== this.mCurrentNotification.body
        ) {
          log("debug", "replace notification", { id: this.mCurrentId });
          this.mCurrentNotification.close();
          this.mCurrentNotification = undefined;
          if (currentNotification) {
            this.showNotification(currentNotification);
          }
        } else {
          currentNotification =
            this.mKnownNotifications[this.mKnownNotifications.length - 1];
          if (
            currentNotification &&
            this.mCurrentId !== currentNotification.id &&
            this.mIsEnabled()
          ) {
            log("debug", "new notification", { id: currentNotification.id });
            // using the js Notification api shows an application id and I'm not sure if I can/how to
            // get rid of it. The electron api works fine for the moment
            // this.showNotification(currentNotification);
            api.events.emit(
              "show-balloon",
              currentNotification.title,
              currentNotification.message,
            );
            this.mCurrentId = currentNotification.id;
          }
        }
      },
    );

    this.mIsEnabled = () => {
      const state: IState = api.store?.getState();
      // Defensive check: interface might not be initialized during hydration
      return state?.settings?.interface?.desktopNotifications ?? false;
    };
  }

  private showNotification(notification: INotification): void {
    this.mCurrentId = notification.id;
    try {
      this.mCurrentNotification = new Notification(notification.title!, {
        tag: notification.id,
        icon:
          notification.icon ||
          path.resolve(getVortexPath("assets"), "images", "vortex.ico"),
        body: notification.message,
        requireInteraction: true,
        silent: true,
      });
    } catch (err) {
      log("warn", "failed to show desktop notification", err);
    }
  }
}

export default GlobalNotifications;
