import * as _ from "lodash";
import React from "react";
import { Badge, Button, Overlay, Popover } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { dismissNotification, fireNotificationAction } from "../actions/notifications";
import { suppressNotification } from "../actions/notificationSettings";
import Icon from "../controls/Icon";
import type { IBar } from "../controls/RadialProgress";
import RadialProgress from "../controls/RadialProgress";
import { useExtensionContext } from "../ExtensionProvider";
import type { INotification, INotificationAction } from "../types/INotification";
import Debouncer from "../util/Debouncer";
import { notifications as notificationsSelector } from "../util/selectors";
import { Notification } from "./Notification";

export interface IBaseProps {
  id: string;
  // force-hide. In this mode notifications are never shown
  hide: boolean;
}

const sortValue = (noti: INotification): number => {
  let value = noti.createdTime;
  if (noti.progress !== undefined || noti.type === "activity") {
    value /= 10;
  }
  return value;
};

const inverseSort = (lhs: INotification, rhs: INotification) => {
  return sortValue(lhs) - sortValue(rhs);
};

const NOTIFICATION_TIMEOUTS: Record<string, number | null> = {
  warning: 10000,
  error: 10000,
  success: 5000,
  info: 5000,
  activity: null,
};

const displayTime = (item: INotification): number | null => {
  if (item.displayMS !== undefined) {
    return item.displayMS;
  }

  // A notification with actions but no explicit displayMS requires the
  // user to choose. Auto-hiding it would silently strand the choice
  // (see INotification displayMS contract).
  if (item.actions !== undefined && item.actions.length > 0) {
    return null;
  }

  return NOTIFICATION_TIMEOUTS[item.type] ?? 10000;
};

export const NotificationButton: React.FC<React.PropsWithChildren<IBaseProps>> = ({ hide }) => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  // Redux state
  const notifications = useSelector(notificationsSelector);

  // Local state
  const [expand, setExpand] = React.useState<string | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  // Whether the user has closed the popover on what it was showing. `open` can't do
  // this on its own: it says whether to keep notifications whose display time has run
  // out, so a popover the user shut on a notification that never expires — an ongoing
  // activity, or one waiting on a choice -- had nothing to shut it.
  const [closed, setClosed] = React.useState(false);
  const [resizing, setResizing] = React.useState(false);
  const [filtered, setFiltered] = React.useState<INotification[]>([]);

  // Refs
  const buttonRef = React.useRef<Button>(null);
  const updateTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = React.useRef(false);
  const prevNotificationsRef = React.useRef(notifications);
  const prevIdsRef = React.useRef<Set<string>>(new Set());

  // Store latest values for callbacks
  const stateRef = React.useRef({ notifications, open, closed, expand, filtered });
  stateRef.current = { notifications, open, closed, expand, filtered };

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

        const timeout = (item.type === "activity" ? item.createdTime : item.updatedTime) + dispTime;
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
          updateTimerRef.current = setTimeout(() => updateFiltered(), nextTimeout - now + 100);
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
      // Grouping only ever merges notifications, so anything in `filtered` is on screen.
      const { closed: isClosed, filtered: filt } = stateRef.current;
      const isShowing = !isClosed && filt.length > 0;

      api.events.emit(
        "analytics-track-click-event",
        "Notifications",
        `${isShowing ? "Close" : "Open"} Notifications`,
      );

      setClosed(isShowing);
      setOpen(!isShowing);
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
      if (notification.group !== undefined && notification.group !== currentExpand) {
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

      const callAction = (actionId: string, action: INotificationAction, idx: number) => {
        if (idx === -1) {
          return;
        }

        if (action.action !== undefined) {
          action.action(() => onDismiss(actionId));
        } else {
          fireNotificationAction(actionId, noti.process, idx, () => onDismiss(actionId));
        }
      };

      if (noti.group === undefined || noti.group === currentExpand) {
        const actionIdx = noti.actions.findIndex((iter) => iter.title === actionTitle);
        callAction(noti.id, noti.actions[actionIdx], actionIdx);
      } else {
        notis
          .filter((iter) => iter.group === noti.group)
          .forEach((iter) => {
            const actionIdx = iter.actions.findIndex((actIter) => actIter.title === actionTitle);
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
      api.events.emit("analytics-track-click-event", "Notifications", "Dismiss");
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
        (notification.localize === undefined || notification.localize.title !== false)
          ? t(translated.title, { replace: translated.replace })
          : translated.title;

      if (collapsed[notification.group] > 1 && translated.title !== undefined) {
        translated.message = t("<Multiple>");
      } else {
        translated.message =
          notification.localize === undefined || notification.localize.message !== false
            ? t(translated.message, { replace: translated.replace })
            : translated.message;
      }

      return (
        <Notification
          collapsed={collapsed[notification.group]}
          key={notification.id}
          params={translated}
          onDismiss={dismissAll}
          onExpand={expandGroup}
          onSuppress={suppress}
          onTriggerAction={triggerAction}
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

  // Whether a notification whose display time has run out belongs in `filtered` turns
  // on `open`, so the filter has to run again when it changes.
  React.useEffect(() => {
    updateDebouncer.current.runNow(() => null);
  }, [open]);

  // A notification arriving is how the popover comes up unasked, so it also undoes a
  // close — otherwise the first one the user shut the popover on would be the last
  // they ever saw. Only a notification we haven't seen counts: an activity reporting
  // progress must not reopen what the user just closed. Silent ones never show at all.
  React.useEffect(() => {
    const hasNew = notifications.some(
      (item) => !prevIdsRef.current.has(item.id) && item.type !== "silent",
    );
    prevIdsRef.current = new Set(notifications.map((item) => item.id));

    if (hasNew) {
      setClosed(false);
    }
  }, [notifications]);

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
      arrowOffsetLeft={64}
      data-testid="notifications-popover"
      id="notifications-popover"
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
      <Button
        data-testid="notifications-button"
        id="notifications-button"
        ref={buttonRef}
        onClick={toggle}
      >
        <Icon name="notifications" />

        <RadialProgress
          className="notifications-progress"
          data={combinedProgress}
          offset={8}
          spin={pendingActivities.length >= 1}
          totalRadius={8}
        />

        {notifications.length === 0 ? null : <Badge>{notifications.length}</Badge>}
      </Button>

      <Overlay
        placement="bottom"
        rootClose={false}
        shouldUpdatePosition={resizing}
        show={!closed && items.length > 0}
        target={buttonRef.current}
        onExit={unExpand}
      >
        {popover}
      </Overlay>
    </div>
  );
};

export default NotificationButton;
