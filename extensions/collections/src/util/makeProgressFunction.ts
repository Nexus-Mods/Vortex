import type { types } from "vortex-api";

export function makeProgressFunction(api: types.IExtensionApi) {
  const notificationId = api.sendNotification({
    type: "activity",
    title: "Building Collection",
    message: "",
    progress: 0,
  });

  let notiPerc = 0;
  let notiText = "";

  const items: Set<string> = new Set();

  const progress = (percent?: number, text?: string) => {
    let change = false;
    if (percent !== undefined) {
      if (percent > notiPerc) {
        change = true;
        notiPerc = percent;
      }
      if (text !== undefined) {
        items.delete(text);
        if (items.size > 0) {
          const itemList = Array.from(items);
          const newText = itemList[itemList.length - 1];
          if (newText !== notiText) {
            change = true;
            notiText = newText;
          }
        }
      }
    }
    if (percent === undefined && text !== undefined && text !== notiText) {
      change = true;
      notiText = text;
      if (percent === undefined) {
        items.add(text);
      }
    }

    if (change) {
      api.sendNotification({
        id: notificationId,
        type: "activity",
        title: "Building Collection",
        progress: notiPerc,
        message: notiText,
      });
    }
  };

  const progressEnd = () => {
    api.dismissNotification(notificationId);
  };

  return { progress, progressEnd };
}
