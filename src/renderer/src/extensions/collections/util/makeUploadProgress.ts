import type { IExtensionApi } from "../../../types/IExtensionContext";
import { bytesToString } from "../../../util/util";

const TITLE = "Uploading Collection";

/**
 * Progress notification for sending a built collection to the API.
 */
export function makeUploadProgress(api: IExtensionApi) {
  const notificationId = api.sendNotification({
    type: "activity",
    title: TITLE,
    message: "",
    progress: 0,
  });

  let lastPercent = -1;

  /** Suitable as the `submit-collection` progress callback. */
  const onProgress = (transferred: number, total: number) => {
    const percent = total > 0 ? Math.floor((transferred / total) * 100) : 0;
    // A retried transfer restarts its body, so this can move backwards.
    if (percent === lastPercent) return;
    lastPercent = percent;

    api.sendNotification({
      id: notificationId,
      type: "activity",
      title: TITLE,
      progress: percent,
      message: `${bytesToString(transferred)} / ${bytesToString(total)}`,
    });
  };

  const uploadEnd = () => {
    api.dismissNotification(notificationId);
  };

  return { onProgress, uploadEnd };
}
