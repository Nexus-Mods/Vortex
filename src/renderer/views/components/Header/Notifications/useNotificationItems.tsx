import { useMemo } from "react";

import type { INotification } from "../../../../types/INotification";

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

interface UseNotificationItemsProps {
  filtered: INotification[];
  expand: string | undefined;
}

interface UseNotificationItemsResult {
  items: INotification[];
  collapsed: { [groupId: string]: number };
}

export const useNotificationItems = ({
  filtered,
  expand,
}: UseNotificationItemsProps): UseNotificationItemsResult => {
  return useMemo(() => {
    const collapsed: { [groupId: string]: number } = {};

    const items = filtered
      .slice()
      .reduce((previous: INotification[], notification: INotification) => {
        if (notification.group !== undefined && notification.group !== expand) {
          if (collapsed[notification.group] === undefined) {
            previous.push(notification);
            collapsed[notification.group] = 0;
          }
          collapsed[notification.group]++;
        } else {
          previous.push(notification);
        }
        return previous;
      }, [])
      .sort(inverseSort);

    return { items, collapsed };
  }, [filtered, expand]);
};
