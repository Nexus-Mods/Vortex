/* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
// Disabled: This component legitimately syncs derived state (filtered notifications)
// in effects based on notification changes and timers.

import {
  dismissNotification,
  fireNotificationAction,
} from "../../actions/notifications";
import { suppressNotification } from "../../actions/notificationSettings";
import type {
  INotification,
  INotificationAction,
} from "../../types/INotification";
import type { IState } from "../../types/IState";

import Icon from "../controls/Icon";
import type { IBar } from "../controls/RadialProgress";
import RadialProgress from "../controls/RadialProgress";
import Debouncer from "../../util/Debouncer";
import { ExtensionContext } from "../../util/ExtensionProvider";
import { Notification } from "./Notification";

import * as _ from "lodash";
import * as React from "react";
import { Badge, Button, Overlay, Popover } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

export interface IBaseProps {
  id: string;
  // force-hide. In this mode notifications are never shown
  hide: boolean;
}

function sortValue(noti: INotification): number {
  let value = noti.createdTime;
  if (noti.progress !== undefined || noti.type === "activity") {
    value /= 10;
  }
  return value;
}

function inverseSort(lhs: INotification, rhs: INotification) {
  return sortValue(lhs) - sortValue(rhs);
}

function displayTime(item: INotification): number | null {
  if (item.displayMS !== undefined) {
    return item.displayMS;
  }

  return (
    {
      warning: 10000,
      error: 10000,
      success: 5000,
      info: 5000,
      activity: null,
    }[item.type] || 10000
  );
}

export const NotificationButton: React.FC<IBaseProps> = ({ hide }) => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const extensions = React.useContext(ExtensionContext);
  const api = extensions.getApi();

  // Redux state
  const notifications = useSelector(
    (state: IState) => state.session.notifications.notifications,
  );

  // Local state
  const [expand, setExpand] = React.useState<string | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const [resizing, setResizing] = React.useState(false);
  const [filtered, setFiltered] = React.useState<INotification[]>([]);

  // Refs
  const buttonRef = React.useRef<Button>(null);
  const updateTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = React.useRef(false);
  const prevNotificationsRef = React.useRef(notifications);

  // Store latest values for callbacks
  const stateRef = React.useRef({ notifications, open, expand, filtered });
  stateRef.current = { notifications, open, expand, filtered };

  // Dispatch callbacks
  const onDismiss = React.useCallback(
    (notificationId: string) => {
      dispatch(dismissNotification(notificationId));
    },
    [dispatch],
  );

  const onSuppress = React.useCallback(
    (notificationId: string) => {
      dispatch(suppressNotification(notificationId, true));
    },
    [dispatch],
  );

  // Debounced resize handlers
  const resizeUpdate = React.useMemo(
    () =>
      _.debounce(
        () => {
          // Force re-render
          setResizing((prev) => prev);
        },
        300,
        { maxWait: 1000, trailing: true },
      ),
    [],
  );

  const resizeUpdating = React.useMemo(
    () =>
      _.debounce(
        () => {
          setResizing(false);
        },
        1000,
        { leading: false, trailing: true },
      ),
    [],
  );

  const updateFiltered = React.useCallback(() => {
    const { notifications: notis, open: isOpen } = stateRef.current;

    updateTimerRef.current = undefined;

    if (!mountedRef.current) {
      return;
    }

    let newFiltered = notis.slice().filter((item) => item.type !== "silent");
    let nextTimeout: number | null = null;
    const now = Date.now();
    if (!isOpen) {
      newFiltered = newFiltered.filter((item) => {
        const dispTime = displayTime(item);
        if (dispTime === null) {
          return true;
        }

        const timeout =
          (item.type === "activity" ? item.createdTime : item.updatedTime) +
          dispTime;
        if (timeout > now) {
          if (nextTimeout === null || timeout < nextTimeout) {
            nextTimeout = timeout;
          }
          return true;
        }

        return false;
      });
    }

    setFiltered(newFiltered);

    if (!isOpen) {
      if (newFiltered.length > 0) {
        if (updateTimerRef.current !== undefined) {
          clearTimeout(updateTimerRef.current);
        }
        if (nextTimeout !== null) {
          updateTimerRef.current = setTimeout(
            () => updateFiltered(),
            nextTimeout - now + 100,
          );
        }
      }
    }
  }, []);

  const updateDebouncer = React.useRef(
    new Debouncer(() => {
      updateFiltered();
      return Promise.resolve();
    }, 200),
  );

  const quickUpdate = React.useCallback(() => {
    const { notifications: notis, filtered: filt } = stateRef.current;
    const updates: Array<{ index: number; notification: INotification }> = [];

    for (let i = 0; i < filt.length; ++i) {
      if (filt[i].id !== undefined) {
        const ref = notis.find((n) => n.id === filt[i].id);
        if (
          ref !== undefined &&
          (filt[i].message !== ref.message || filt[i].progress !== ref.progress)
        ) {
          updates.push({
            index: i,
            notification: {
              ...filt[i],
              message: ref.message,
              progress: ref.progress,
            },
          });
        }
      }
    }

    if (updates.length > 0) {
      setFiltered((prev) => {
        const newFiltered = [...prev];
        updates.forEach(({ index, notification }) => {
          newFiltered[index] = notification;
        });
        return newFiltered;
      });
    }
  }, []);

  const onResize = React.useCallback(() => {
    setResizing(true);
    resizeUpdate();
    resizeUpdating();
  }, [resizeUpdate, resizeUpdating]);

  const toggle = React.useCallback(
    (evt: React.MouseEvent<unknown>) => {
      evt.preventDefault();
      const { open: isOpen } = stateRef.current;
      api.events.emit(
        "analytics-track-click-event",
        "Notifications",
        `${isOpen ? "Close" : "Open"} Notifications`,
      );
      setOpen(!isOpen);
      setTimeout(() => {
        updateDebouncer.current.runNow(() => null);
      }, 0);
    },
    [api],
  );

  const groupNotifications = React.useCallback(
    (
      previous: INotification[],
      notification: INotification,
      collapsed: { [groupId: string]: number },
    ) => {
      const { expand: currentExpand } = stateRef.current;
      if (
        notification.group !== undefined &&
        notification.group !== currentExpand
      ) {
        if (collapsed[notification.group] === undefined) {
          previous.push(notification);
          collapsed[notification.group] = 0;
        }
        collapsed[notification.group]++;
      } else {
        previous.push(notification);
      }
      return previous;
    },
    [],
  );

  const expandGroup = React.useCallback((groupId: string) => {
    setExpand(groupId);
  }, []);

  const unExpand = React.useCallback(() => {
    setExpand(undefined);
  }, []);

  const suppress = React.useCallback(
    (notificationId: string) => {
      onDismiss(notificationId);
      onSuppress(notificationId);
    },
    [onDismiss, onSuppress],
  );

  const triggerAction = React.useCallback(
    (notificationId: string, actionTitle: string) => {
      const { notifications: notis, expand: currentExpand } = stateRef.current;
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

      if (noti.group === undefined || noti.group === currentExpand) {
        const actionIdx = noti.actions.findIndex(
          (iter) => iter.title === actionTitle,
        );
        callAction(noti.id, noti.actions[actionIdx], actionIdx);
      } else {
        notis
          .filter((iter) => iter.group === noti.group)
          .forEach((iter) => {
            const actionIdx = iter.actions.findIndex(
              (actIter) => actIter.title === actionTitle,
            );
            callAction(iter.id, iter.actions[actionIdx], actionIdx);
          });
      }
    },
    [onDismiss],
  );

  const dismissAll = React.useCallback(
    (notificationId: string) => {
      const { notifications: notis, expand: currentExpand } = stateRef.current;
      const noti = notis.find((iter) => iter.id === notificationId);
      api.events.emit(
        "analytics-track-click-event",
        "Notifications",
        "Dismiss",
      );
      if (noti === undefined) {
        return;
      }
      if (noti.group === undefined || noti.group === currentExpand) {
        onDismiss(notificationId);
      } else {
        notis
          .filter((iter) => iter.group === noti.group)
          .forEach((iter) => {
            onDismiss(iter.id);
          });
      }
    },
    [api, onDismiss],
  );

  const renderNotification = React.useCallback(
    (notification: INotification, collapsed: { [groupId: string]: number }) => {
      const translated: INotification = { ...notification };
      translated.title =
        translated.title !== undefined &&
        (notification.localize === undefined ||
          notification.localize.title !== false)
          ? t(translated.title, { replace: translated.replace })
          : translated.title;

      if (collapsed[notification.group] > 1 && translated.title !== undefined) {
        translated.message = t("<Multiple>");
      } else {
        translated.message =
          notification.localize === undefined ||
          notification.localize.message !== false
            ? t(translated.message, { replace: translated.replace })
            : translated.message;
      }

      return (
        <Notification
          key={notification.id}
          params={translated}
          collapsed={collapsed[notification.group]}
          onExpand={expandGroup}
          onTriggerAction={triggerAction}
          onDismiss={dismissAll}
          onSuppress={suppress}
        />
      );
    },
    [t, expandGroup, triggerAction, dismissAll, suppress],
  );

  // Mount/unmount
  React.useEffect(() => {
    mountedRef.current = true;
    updateFiltered();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      mountedRef.current = false;
      if (updateTimerRef.current !== undefined) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [onResize, updateFiltered]);

  // Handle notifications changes
  React.useEffect(() => {
    if (prevNotificationsRef.current !== notifications) {
      if (prevNotificationsRef.current.length !== notifications.length) {
        updateDebouncer.current.runNow(() => null);
      } else {
        quickUpdate();
        updateDebouncer.current.schedule();
      }
      prevNotificationsRef.current = notifications;
    }
  }, [notifications, quickUpdate]);

  // Render
  const collapsed: { [groupId: string]: number } = {};

  const items = filtered
    .slice()
    .reduce(
      (prev: INotification[], notification: INotification) =>
        groupNotifications(prev, notification, collapsed),
      [],
    )
    .sort(inverseSort)
    .map((notification) => renderNotification(notification, collapsed));

  const popover = (
    <Popover
      id="notifications-popover"
      arrowOffsetLeft={64}
      style={{ display: hide ? "none" : "block" }}
    >
      {items.length > 0 ? items : t("No Notifications")}
    </Popover>
  );

  const combinedProgress: IBar[] = [];

  const progress = notifications.filter((iter) => iter.progress !== undefined);
  if (progress.length > 0) {
    const percentages = Math.min(...progress.map((iter) => iter.progress));
    combinedProgress.push({
      class: "running",
      min: 0,
      max: 100,
      value: percentages,
    });
  }

  const pendingActivities = notifications.filter(
    (iter) => iter.type === "activity" && iter.progress === undefined,
  );

  return (
    <div style={{ display: "inline-block" }}>
      <Button id="notifications-button" onClick={toggle} ref={buttonRef}>
        <Icon name="notifications" />
        <RadialProgress
          className="notifications-progress"
          data={combinedProgress}
          spin={pendingActivities.length >= 1}
          offset={8}
          totalRadius={8}
        />
        {notifications.length === 0 ? null : (
          <Badge>{notifications.length}</Badge>
        )}
      </Button>

      <Overlay
        placement="bottom"
        rootClose={false}
        onExit={unExpand}
        show={items.length > 0}
        target={buttonRef.current}
        shouldUpdatePosition={resizing}
      >
        {popover}
      </Overlay>
    </div>
  );
};

export default NotificationButton;
