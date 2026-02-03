import { useTranslation } from "react-i18next";

import type { INotification } from "../../../../../types/INotification";

interface UseNotificationTranslationProps {
  notification: INotification;
  collapsed: number;
}

export const useNotificationTranslation = ({
  notification,
  collapsed,
}: UseNotificationTranslationProps) => {
  const { t } = useTranslation(["common"]);
  const { title, message, localize, replace } = notification;

  const translatedTitle =
    title !== undefined && (localize === undefined || localize.title !== false)
      ? t(title, { replace })
      : title;

  const translatedMessage =
    collapsed > 1 && translatedTitle !== undefined
      ? t("<Multiple>")
      : localize === undefined || localize.message !== false
        ? t(message, { replace })
        : message;

  return { translatedTitle, translatedMessage };
};
