import { describe, it, expect } from "vitest";

import type { IDialog } from "../types/IDialog";
import type { INotification } from "../types/INotification";
import type { INotificationState } from "../types/IState";
import { notificationsReducer } from "./notifications";

const reduce = notificationsReducer.reducers as {
  ADD_NOTIFICATION: (
    state: INotificationState,
    payload: Partial<INotification>,
  ) => INotificationState;
  STOP_NOTIFICATION: (state: INotificationState, payload: string) => INotificationState;
  SHOW_MODAL_DIALOG: (state: INotificationState, payload: IDialog) => INotificationState;
  DISMISS_MODAL_DIALOG: (state: INotificationState, payload: string) => INotificationState;
};

describe("startNotification", () => {
  const input: INotificationState = { notifications: [], dialogs: [] };
  it("appends the notification", () => {
    const notification: INotification = {
      id: "42",
      message: "test",
      type: "info",
    };
    const result = reduce.ADD_NOTIFICATION(input, notification);
    expect(result.notifications).toContain(notification);
  });

  it("generates an id if required", () => {
    const notification: Partial<INotification> = {
      message: "test",
      type: "info",
    };
    const result = reduce.ADD_NOTIFICATION(input, notification);
    expect(result.notifications[0].id).not.toBeUndefined();
  });
});

describe("dismissNotification", () => {
  const notification: INotification = {
    id: "42",
    message: "test",
    type: "info",
  };
  const input: INotificationState = {
    notifications: [notification],
    dialogs: [],
  };
  it("removes the notification", () => {
    const result = reduce.STOP_NOTIFICATION(input, "42");
    expect(result.notifications.length).toBe(0);
  });

  it("does nothing on an invalid id", () => {
    const result = reduce.STOP_NOTIFICATION(input, "43");
    expect(result.notifications).toContain(notification);
  });
});

describe("dismissDialog", () => {
  const dialogA: IDialog = {
    id: "42",
    type: "info",
    title: "title",
    content: { message: "message" },
    defaultAction: "Close",
    actions: ["Close"],
  };
  const dialogB: IDialog = {
    id: "43",
    type: "info",
    title: "title2",
    content: { message: "message2" },
    defaultAction: "Close",
    actions: ["Close"],
  };
  const input: INotificationState = {
    notifications: [],
    dialogs: [dialogA, dialogB],
  };
  it("dismisses the specified dialog", () => {
    const result = reduce.DISMISS_MODAL_DIALOG(input, "42");
    expect(result.dialogs.length).toBe(1);
    expect(result.dialogs[0]).toEqual(dialogB);
  });
});

describe("showDialog", () => {
  const input: INotificationState = { notifications: [], dialogs: [] };
  it("appends a dialog to be shown", () => {
    const dialog: IDialog = {
      id: "42",
      type: "info",
      title: "title",
      content: { message: "message" },
      defaultAction: "Close",
      actions: ["Close"],
    };
    const result = reduce.SHOW_MODAL_DIALOG(input, dialog);
    expect(result.dialogs.length).toBe(1);
    expect(result.dialogs[0]).toEqual(dialog);
  });
});
