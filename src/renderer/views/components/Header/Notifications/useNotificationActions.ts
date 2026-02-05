import { useCallback, useRef } from "react";
import { useDispatch } from "react-redux";

import type {
  INotification,
  INotificationAction,
} from "../../../../../types/INotification";

import {
  dismissNotification,
  fireNotificationAction,
} from "../../../../../actions/notifications";
import { suppressNotification } from "../../../../../actions/notificationSettings";
import { useExtensionContext } from "../../../../../util/ExtensionProvider";

interface UseNotificationActionsProps {
  notifications: INotification[];
  expand: string | undefined;
}

export const useNotificationActions = ({
  notifications,
  expand,
}: UseNotificationActionsProps) => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const stateRef = useRef({ notifications, expand });
  stateRef.current = { notifications, expand };

  const onDismiss = useCallback(
    (notificationId: string) => {
      dispatch(dismissNotification(notificationId));
    },
    [dispatch],
  );

  const onSuppress = useCallback(
    (notificationId: string) => {
      dispatch(suppressNotification(notificationId, true));
    },
    [dispatch],
  );

  const suppress = useCallback(
    (notificationId: string) => {
      onDismiss(notificationId);
      onSuppress(notificationId);
    },
    [onDismiss, onSuppress],
  );

  /**
   * Applies a callback to either a single notification or all notifications in its group.
   * If the notification is in a group and not expanded, applies to all notifications in that group.
   * Otherwise, applies only to the single notification.
   */
  const applyToNotificationGroup = useCallback(
    (
      notificationId: string,
      callback: (notification: INotification) => void,
    ) => {
      const { notifications: notis, expand: currentExpand } = stateRef.current;
      const noti = notis.find((iter) => iter.id === notificationId);

      if (noti === undefined) {
        return;
      }

      if (noti.group === undefined || noti.group === currentExpand) {
        callback(noti);
      } else {
        notis
          .filter((iter) => iter.group === noti.group)
          .forEach((iter) => callback(iter));
      }
    },
    [],
  );

  const triggerAction = useCallback(
    (notificationId: string, actionTitle: string) => {
      const { notifications: notis } = stateRef.current;
      const noti = notis.find((iter) => iter.id === notificationId);
      if (noti === undefined) {
        return;
      }

      const callAction = (
        actionId: string,
        action: INotificationAction,
        idx: number,
      ) => {
        if (idx === -1) {
          return;
        }

        if (action.action !== undefined) {
          action.action(() => onDismiss(actionId));
        } else {
          fireNotificationAction(actionId, noti.process, idx, () =>
            onDismiss(actionId),
          );
        }
      };

      applyToNotificationGroup(notificationId, (iter) => {
        const actionIdx = iter.actions.findIndex(
          (actIter) => actIter.title === actionTitle,
        );
        callAction(iter.id, iter.actions[actionIdx], actionIdx);
      });
    },
    [onDismiss, applyToNotificationGroup],
  );

  const dismissAll = useCallback(
    (notificationId: string) => {
      api.events.emit(
        "analytics-track-click-event",
        "Notifications",
        "Dismiss",
      );
      applyToNotificationGroup(notificationId, (iter) => {
        onDismiss(iter.id);
      });
    },
    [api, onDismiss, applyToNotificationGroup],
  );

  return {
    onDismiss,
    onSuppress,
    suppress,
    triggerAction,
    dismissAll,
  };
};
