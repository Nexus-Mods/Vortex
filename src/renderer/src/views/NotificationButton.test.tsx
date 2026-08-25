import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { INotification } from "../types/INotification";

const { dispatch, emit } = vi.hoisted(() => ({ dispatch: vi.fn(), emit: vi.fn() }));

vi.mock("../ExtensionProvider", () => ({
  useExtensionContext: () => ({ getApi: () => ({ events: { emit } }) }),
}));

// Icon loads its font set into an `#icon-sets` element the real document has and this
// one doesn't. Nothing here turns on which glyph is drawn.
vi.mock("../controls/Icon", () => ({ default: () => null }));

/** Rewritten per test, then read by the real selector through the mocked hook. */
const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (state: unknown) => unknown) => selector(store.state),
  };
});

import { NotificationButton } from "./NotificationButton";

const withNotifications = (notifications: INotification[]) => {
  store.state = { session: { notifications: { notifications } } };
};

/**
 * A notification offering the user a choice. `displayTime` returns null for these, so
 * nothing ever filters it out — which is what made the popover unclosable.
 */
const choice = (id: string): INotification => ({
  id,
  type: "info",
  message: "needs an answer",
  createdTime: Date.now(),
  updatedTime: Date.now(),
  actions: [{ title: "Fix", action: () => undefined }],
});

/** A plain notification, which does expire on its own. */
const transient = (id: string): INotification => ({
  id,
  type: "info",
  message: "for information",
  createdTime: Date.now(),
  updatedTime: Date.now(),
});

const popover = () => screen.queryByTestId("notifications-popover");

const renderButton = () => render(<NotificationButton hide={false} id="notification-button" />);

describe("NotificationButton", () => {
  beforeEach(() => {
    dispatch.mockClear();
    emit.mockClear();
  });

  it("shows the popover by itself when there is a notification", async () => {
    withNotifications([transient("a")]);
    renderButton();

    await waitFor(() => expect(popover()).toBeInTheDocument());
  });

  // The bug: `open` only governed whether expired notifications stay listed, so a
  // notification that never expires left the popover with nothing to close it.
  it("closes on the button even when the notification never expires", async () => {
    withNotifications([choice("a")]);
    renderButton();

    await waitFor(() => expect(popover()).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("notifications-button"));

    await waitFor(() => expect(popover()).not.toBeInTheDocument());
  });

  it("reports the close to analytics as a close", async () => {
    withNotifications([choice("a")]);
    renderButton();

    await waitFor(() => expect(popover()).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("notifications-button"));

    expect(emit).toHaveBeenCalledWith(
      "analytics-track-click-event",
      "Notifications",
      "Close Notifications",
    );
  });

  it("comes back when a notification the user has not seen arrives", async () => {
    withNotifications([choice("a")]);
    const { rerender } = renderButton();

    await waitFor(() => expect(popover()).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("notifications-button"));
    await waitFor(() => expect(popover()).not.toBeInTheDocument());

    withNotifications([choice("a"), transient("b")]);
    rerender(<NotificationButton hide={false} id="notification-button" />);

    await waitFor(() => expect(popover()).toBeInTheDocument());
  });

  // Otherwise a download reporting progress would reopen what the user just closed.
  it("stays closed while a notification it already knows about changes", async () => {
    const activity: INotification = {
      id: "a",
      type: "activity",
      message: "working",
      progress: 10,
      createdTime: Date.now(),
      updatedTime: Date.now(),
    };

    withNotifications([activity]);
    const { rerender } = renderButton();

    await waitFor(() => expect(popover()).toBeInTheDocument());
    await userEvent.click(screen.getByTestId("notifications-button"));
    await waitFor(() => expect(popover()).not.toBeInTheDocument());

    withNotifications([{ ...activity, progress: 60, updatedTime: Date.now() }]);
    rerender(<NotificationButton hide={false} id="notification-button" />);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(popover()).not.toBeInTheDocument();
  });
});
