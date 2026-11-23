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

const interactive = { interactive: true };
const readOnly = { interactive: false };

describe("notificationHideAt", () => {
  it("counts displayMS from the last update, so a replacement gets its full time", () => {
    expect(notificationHideAt(notification({ displayMS: 7000 }), interactive)).toBe(38_000);
  });

  it("falls back to the type's default time", () => {
    expect(notificationHideAt(notification({ type: "error" }), interactive)).toBe(41_000);
  });

  it("keeps a notification with actions and no displayMS up until dismissed", () => {
    const noti = notification({ actions: [edit] });
    expect(notificationHideAt(noti, interactive)).toBeNull();
  });

  it("hides a notification with actions on its type's time in a view that can't show them", () => {
    const noti = notification({ type: "error", actions: [edit] });
    expect(notificationHideAt(noti, readOnly)).toBe(41_000);
  });

  it("still hides a notification with actions when it sets displayMS", () => {
    const noti = notification({ actions: [edit], displayMS: 7000 });
    expect(notificationHideAt(noti, interactive)).toBe(38_000);
  });

  it("counts an activity from when it started", () => {
    const noti = notification({ type: "activity", displayMS: 7000 });
    expect(notificationHideAt(noti, interactive)).toBe(8_000);
  });

  it("hides an activity without displayMS 10s after it started", () => {
    expect(notificationHideAt(notification({ type: "activity" }), interactive)).toBe(11_000);
  });
});
