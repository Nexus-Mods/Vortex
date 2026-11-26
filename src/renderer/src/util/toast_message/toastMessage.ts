import type { INotification } from "@/types/INotification";

type Translate = (key: string, options?: { replace?: INotification["replace"] }) => string;

/**
 * The text a notification shows as a toast. It's translated the same way the
 * notification bell translates it (`replace` and `localize` included), so a
 * message reads the same whichever of the two shows it.
 */
export function toastMessage(notification: INotification, t: Translate): string {
  const { title, message, replace, localize } = notification;
  const translate = (text: string | undefined, enabled: boolean | undefined) =>
    text === undefined || enabled === false ? text : t(text, { replace });

  const translatedTitle = translate(title, localize?.title);
  const translatedMessage = translate(message, localize?.message) ?? "";
  return translatedTitle !== undefined
    ? `${translatedTitle}:\n${translatedMessage}`
    : translatedMessage;
}
