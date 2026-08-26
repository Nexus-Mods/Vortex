import { render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { INotification, NotificationType } from "@/types/INotification";

const mocks = vi.hoisted(() => ({
  notifications: [] as INotification[],
}));

vi.mock("react-redux", () => ({
  useSelector: () => mocks.notifications,
  useDispatch: () => vi.fn(),
}));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({ getApi: () => ({ events: { emit: vi.fn() } }) }),
}));

// The panel's contents are unchanged by this ticket and pull in a debouncer and the
// redux store; the trigger is what moved, so the panel hooks are stubbed to empty.
vi.mock("./hooks/useNotificationFiltering.hook", () => ({ useNotificationFiltering: () => [] }));
vi.mock("./hooks/useNotificationItems.hook", () => ({
  useNotificationItems: () => ({ items: [], collapsed: {} }),
}));
vi.mock("./hooks/useNotificationActions.hook", () => ({
  useNotificationActions: () => ({
    dismissAll: vi.fn(),
    suppress: vi.fn(),
    triggerAction: vi.fn(),
  }),
}));

import { Notifications, pipSeverity } from "./Notifications";

// --- Helpers ---

let nextId = 0;
const notification = (type: NotificationType): INotification => ({
  id: `n${nextId++}`,
  type,
  message: `a ${type}`,
});

const renderComponent = (types: NotificationType[]) => {
  mocks.notifications = types.map(notification);
  const { container } = render(<Notifications />);

  return {
    container,
    bell: within(container).getByRole("button", { name: "Notifications" }),
    pip: () => within(container).queryByTestId("notification-pip"),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notifications = [];
});

// --- Tests ---

describe("pipSeverity", () => {
  it("returns nothing when there is nothing waiting", () => {
    expect(pipSeverity([])).toBeUndefined();
  });

  it("ignores silent notifications, which the user never sees", () => {
    expect(pipSeverity([notification("silent")])).toBeUndefined();
  });

  it.each<[NotificationType, string]>([
    ["error", "error"],
    ["warning", "warning"],
    ["info", "info"],
    ["success", "info"],
    ["activity", "info"],
    ["global", "info"],
  ])("maps a lone %s notification to the %s pip", (type, expected) => {
    expect(pipSeverity([notification(type)])).toBe(expected);
  });

  it("lets a single error outrank a pile of warnings", () => {
    const types: NotificationType[] = ["warning", "warning", "error", "warning"];
    expect(pipSeverity(types.map(notification))).toBe("error");
  });

  it("lets a warning outrank info and success", () => {
    const types: NotificationType[] = ["info", "success", "warning"];
    expect(pipSeverity(types.map(notification))).toBe("warning");
  });

  it("ranks by severity, not by which arrived last", () => {
    const types: NotificationType[] = ["error", "info"];
    expect(pipSeverity(types.map(notification))).toBe("error");
  });
});

describe("Notifications trigger", () => {
  it("shows no pip and disables the bell when there is nothing waiting", () => {
    const { bell, pip } = renderComponent([]);
    expect(pip()).toBeNull();
    expect(bell).toBeDisabled();
  });

  it("stays disabled when the only notification is silent", () => {
    const { bell, pip } = renderComponent(["silent"]);
    expect(pip()).toBeNull();
    expect(bell).toBeDisabled();
  });

  it.each<[NotificationType, string]>([
    ["error", "bg-danger-moderate"],
    ["warning", "bg-warning-moderate"],
    ["info", "bg-info-moderate"],
  ])("colours the pip for a %s notification", (type, expectedClass) => {
    const { pip } = renderComponent([type]);
    expect(pip()).toHaveClass(expectedClass);
  });

  it("enables the bell once something is waiting", () => {
    const { bell } = renderComponent(["info"]);
    expect(bell).toBeEnabled();
  });

  it("renders as a spine button, matching its download-button sibling", () => {
    const { bell } = renderComponent(["info"]);
    expect(bell).toHaveClass("size-12", "rounded-full", "border-2");
  });

  it("marks itself active while the tray is open", () => {
    // The tray auto-opens when notifications arrive, so rendering with one is enough.
    const { bell } = renderComponent(["info"]);
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(bell).toHaveClass("border-neutral-strong");
  });

  it("is not marked active while the tray is closed", () => {
    renderComponent([]);
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveClass("border-stroke-weak");
  });
});
