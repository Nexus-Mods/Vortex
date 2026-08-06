import { describe, it, expect, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { makeUploadProgress } from "./makeUploadProgress";

type Notification = {
  id?: string;
  title?: string;
  progress?: number;
  message?: string;
  actions?: Array<{ title: string; action: () => void }>;
};

function makeApi() {
  const notifications: Notification[] = [];
  const dismissNotification = vi.fn();
  const api = {
    sendNotification: vi.fn((noti: Notification) => {
      notifications.push(noti);
      return noti.id ?? "upload-noti";
    }),
    dismissNotification,
  } as unknown as IExtensionApi;

  return { api, notifications, dismissNotification };
}

const latest = (notifications: Notification[]): Notification =>
  notifications[notifications.length - 1]!;

const MB = 1024 * 1024;

describe("makeUploadProgress", () => {
  it("opens its own notification, separate from the build one", () => {
    const { api, notifications } = makeApi();

    makeUploadProgress(api);

    expect(latest(notifications)).toMatchObject({
      title: "Uploading Collection",
      progress: 0,
    });
  });

  it("reports percentage and byte counts as the transfer runs", () => {
    const { api, notifications } = makeApi();
    const { onProgress } = makeUploadProgress(api);

    onProgress(2 * MB, 8 * MB);

    expect(latest(notifications)).toMatchObject({
      title: "Uploading Collection",
      progress: 25,
      message: "2.0 MB / 8.0 MB",
    });
  });

  it("moves the bar backwards when a transfer is retried", () => {
    const { api, notifications } = makeApi();
    const { onProgress } = makeUploadProgress(api);

    onProgress(6 * MB, 8 * MB);
    onProgress(0, 8 * MB);

    expect(latest(notifications).progress).toBe(0);
  });

  it("skips updates that would not change the percentage", () => {
    const { api, notifications } = makeApi();
    const { onProgress } = makeUploadProgress(api);

    const before = notifications.length;
    onProgress(1000, 8 * MB);
    onProgress(1001, 8 * MB);

    expect(notifications.length - before).toBe(1);
  });

  it("treats an unknown total as no progress rather than dividing by zero", () => {
    const { api, notifications } = makeApi();
    const { onProgress } = makeUploadProgress(api);

    onProgress(1234, 0);

    expect(latest(notifications).progress).toBe(0);
  });

  it("offers a Cancel action that calls back", () => {
    const { api, notifications } = makeApi();
    const onCancel = vi.fn();

    makeUploadProgress(api, onCancel);
    const [action] = latest(notifications).actions ?? [];
    action?.action();

    expect(action?.title).toBe("Cancel");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps the Cancel action on later updates", () => {
    const { api, notifications } = makeApi();
    const { onProgress } = makeUploadProgress(api, vi.fn());

    onProgress(1 * MB, 8 * MB);

    // The notification is re-sent wholesale, so an omitted action disappears.
    expect(latest(notifications).actions?.[0]?.title).toBe("Cancel");
  });

  it("offers no action when the upload cannot be canceled", () => {
    const { api, notifications } = makeApi();

    makeUploadProgress(api);

    expect(latest(notifications).actions).toBeUndefined();
  });

  it("dismisses its notification when the upload settles", () => {
    const { api, dismissNotification } = makeApi();
    const { uploadEnd } = makeUploadProgress(api);

    uploadEnd();

    expect(dismissNotification).toHaveBeenCalledOnce();
  });
});
