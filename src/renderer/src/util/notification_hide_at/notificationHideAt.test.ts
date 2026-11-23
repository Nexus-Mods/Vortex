import { describe, expect, it } from "vitest";

import type { INotification } from "@/types/INotification";

import { notificationHideAt } from "./notificationHideAt";

const notification = (fields: Partial<INotification>): INotification => ({
  type: "success",
  message: "Restoring plugins complete",
  createdTime: 1_000,
  updatedTime: 31_000,
  ...fields,
});

const edit = { title: "Edit", action: () => undefined };

describe("notificationHideAt", () => {
  it("counts displayMS from the last update, so a replacement gets its full time", () => {
    expect(notificationHideAt(notification({ displayMS: 7000 }))).toBe(38_000);
  });

  it("falls back to the type's default time", () => {
    expect(notificationHideAt(notification({ type: "error" }))).toBe(41_000);
  });

  it("keeps a notification with actions and no displayMS up until dismissed", () => {
    const noti = notification({ actions: [edit] });
    expect(notificationHideAt(noti)).toBeNull();
  });

  it("still hides a notification with actions when it sets displayMS", () => {
    const noti = notification({ actions: [edit], displayMS: 7000 });
    expect(notificationHideAt(noti)).toBe(38_000);
  });

  it("counts an activity from when it started", () => {
    const noti = notification({ type: "activity", displayMS: 7000 });
    expect(notificationHideAt(noti)).toBe(8_000);
  });

  it("hides an activity without displayMS 10s after it started", () => {
    expect(notificationHideAt(notification({ type: "activity" }))).toBe(11_000);
  });
});
