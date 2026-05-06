/* eslint-disable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
// This hook requires direct setState calls in effects due to its architecture:
// - updateFiltered() schedules future updates via setTimeout when timers fire
// - quickUpdate() performs incremental updates for performance
// This pattern matches the Classic implementation and is correct for this use case.

import { useCallback, useEffect, useRef, useState } from "react";

import type { INotification } from "../../../../types/INotification";
import Debouncer from "../../../../util/Debouncer";

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

  return NOTIFICATION_TIMEOUTS[item.type] ?? 10000;
};

interface UseNotificationFilteringProps {
  notifications: INotification[];
  open: boolean;
}

export const useNotificationFiltering = ({
  notifications,
  open,
}: UseNotificationFilteringProps) => {
  const [filtered, setFiltered] = useState<INotification[]>([]);

  const updateTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(false);
  const prevNotificationsRef = useRef(notifications);

  const stateRef = useRef({ notifications, open, filtered });
  stateRef.current = { notifications, open, filtered };

  const updateFiltered = useCallback(() => {
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

  const updateDebouncer = useRef(
    new Debouncer(() => {
      updateFiltered();
      return Promise.resolve();
    }, 200),
  );

  const quickUpdate = useCallback(() => {
    const { notifications: notis, filtered: filt } = stateRef.current;
    const updates: INotification[] = [];

    for (const item of filt) {
      if (item?.id === undefined) {
        continue;
      }
      const ref = notis.find((n) => n?.id === item.id);
      if (ref !== undefined && (item.message !== ref.message || item.progress !== ref.progress)) {
        updates.push({ ...item, message: ref.message, progress: ref.progress });
      }
    }

    if (updates.length > 0) {
      setFiltered((prev) => {
        const byId = new Map(updates.map((u) => [u.id, u]));
        return prev.map((item) => (item?.id !== undefined ? (byId.get(item.id) ?? item) : item));
      });
    }
  }, []);

  // Mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    updateFiltered();

    return () => {
      mountedRef.current = false;
      if (updateTimerRef.current !== undefined) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [updateFiltered]);

  // Handle notifications changes
  useEffect(() => {
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

  // Handle open state changes
  useEffect(() => {
    if (open) {
      updateDebouncer.current.runNow(() => null);
    }
  }, [open]);

  return filtered;
};
