import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setZoomFactor } from "@/actions";

import { ZOOM_SHORTCUT_EVENT } from "../utils/zoom";

const { dispatch, state } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  state: { current: { settings: { window: { zoomFactor: 1 } } } },
}));

// See SettingsInterface.test.tsx: the global stub doesn't interpolate "{{percent}}%".
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => {
    const t = (key: string, options?: { replace?: Record<string, string | number> }) =>
      key.replace(/{{(\w+)}}/g, (_match, name: string) => String(options?.replace?.[name] ?? ""));
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
  };
});

import { ZoomHotkeyIndicator } from "./ZoomHotkeyIndicator";

beforeEach(() => {
  state.current = { settings: { window: { zoomFactor: 1 } } };
  dispatch.mockClear();
});

describe("ZoomHotkeyIndicator", () => {
  it("stays hidden until a zoom shortcut fires", () => {
    render(<ZoomHotkeyIndicator />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("appears when the zoom shortcut event fires", () => {
    render(<ZoomHotkeyIndicator />);

    act(() => window.dispatchEvent(new Event(ZOOM_SHORTCUT_EVENT)));

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("closes on its own a few seconds after the last change", async () => {
    // Headless UI's Transition never resolves its leave phase under happy-dom (no real CSS
    // engine to time against), so this checks that the leave phase started — the signal our
    // own timeout logic controls — rather than waiting for the unmount that follows it.
    vi.useFakeTimers();
    render(<ZoomHotkeyIndicator />);

    act(() => window.dispatchEvent(new Event(ZOOM_SHORTCUT_EVENT)));
    const panel = screen.getByRole("status");
    expect(panel).not.toHaveAttribute("data-leave");

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(panel).toHaveAttribute("data-leave");

    vi.useRealTimers();
  });

  it("stays open while the pointer is over it", async () => {
    vi.useFakeTimers();
    render(<ZoomHotkeyIndicator />);

    act(() => window.dispatchEvent(new Event(ZOOM_SHORTCUT_EVENT)));
    const panel = screen.getByRole("status");
    fireEvent.pointerEnter(panel);

    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(panel).not.toHaveAttribute("data-leave");

    vi.useRealTimers();
  });

  it("dispatches a 10% step and re-shows itself when Zoom in is clicked", async () => {
    render(<ZoomHotkeyIndicator />);
    act(() => window.dispatchEvent(new Event(ZOOM_SHORTCUT_EVENT)));

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(dispatch).toHaveBeenCalledWith(setZoomFactor(1.1));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
