import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZOOM_SHORTCUT_EVENT } from "@/util/zoom";

import { ZoomControl } from "./ZoomControl";

const state = vi.hoisted(() => ({ factor: 1 }));
vi.mock("react-redux", () => ({ useSelector: () => state.factor, useDispatch: () => vi.fn() }));

/** What `initializeZoom` announces for each shortcut or Ctrl+wheel step. */
function shortcut() {
  fireEvent(window, new Event(ZOOM_SHORTCUT_EVENT));
}

beforeEach(() => {
  vi.useFakeTimers();
  state.factor = 1;
});
afterEach(() => vi.useRealTimers());

describe("ZoomControl", () => {
  it("preserves focus outside the popup when shortcuts open and dismiss it", async () => {
    state.factor = 1.2;
    render(
      <>
        <input data-testid="search" />

        <ZoomControl />
      </>,
    );
    const input = screen.getByTestId("search");
    input.focus();
    shortcut();
    expect(input).toHaveFocus();
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(input).toHaveFocus();
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
  });

  it("returns focus from popup controls on Escape but leaves outside focus alone", () => {
    state.factor = 1.2;
    render(<ZoomControl />);
    shortcut();
    screen.getByRole("button", { name: "Zoom in" }).focus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("zoom-control")).toHaveFocus();
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
  });

  it("hides the default zoom button until a wheel gesture, then shows it muted", () => {
    render(<ZoomControl />);
    expect(screen.queryByTestId("zoom-control")).not.toBeInTheDocument();
    shortcut();
    const button = screen.getByTestId("zoom-control");
    expect(button).toHaveClass("opacity-50");
    expect(button).toBeEnabled();
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
  });

  it("starts closing three seconds after the last scroll, then finishes its exit transition", async () => {
    render(<ZoomControl />);
    shortcut();
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    shortcut();
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
    expect(screen.queryByTestId("zoom-control")).not.toBeInTheDocument();
  });

  it("leaves the bar closed for ordinary scrolling", () => {
    render(<ZoomControl />);
    fireEvent.wheel(window, { deltaY: -120 });
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
  });

  it("reopens during the exit animation when another shortcut arrives", async () => {
    render(<ZoomControl />);
    shortcut();
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
    shortcut();
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
  });

  it("clears the trigger's active state and focus when blank space is clicked", async () => {
    state.factor = 1.2;
    render(<ZoomControl />);
    const button = screen.getByTestId("zoom-control");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(document.body);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveFocus();
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
  });

  it("keeps the bar open for three seconds after a button returns zoom to 100%", async () => {
    state.factor = 0.9;
    const { rerender } = render(<ZoomControl />);
    fireEvent.click(screen.getByTestId("zoom-control"));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    state.factor = 1;
    rerender(<ZoomControl />);
    await act(async () => vi.advanceTimersByTimeAsync(2999));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("zoom-popover")).toHaveTextContent("100%");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId("zoom-control")).not.toBeInTheDocument();
  });

  it("uses the same three-second timer for a manual opening and Reset", async () => {
    state.factor = 1.2;
    const { rerender } = render(<ZoomControl />);
    fireEvent.click(screen.getByTestId("zoom-control"));
    await act(async () => vi.advanceTimersByTimeAsync(2999));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    state.factor = 1;
    rerender(<ZoomControl />);
    await act(async () => vi.advanceTimersByTimeAsync(2999));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
  });

  it("stays open while keyboard focus is inside, then times out once it leaves", async () => {
    state.factor = 1.2;
    render(
      <>
        <input data-testid="search" />

        <ZoomControl />
      </>,
    );
    shortcut();
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    act(() => zoomIn.focus());
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    act(() => screen.getByTestId("zoom-control").focus());
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
  });

  it("stays open while the pointer is over it, then times out once it leaves", () => {
    state.factor = 1.2;
    render(<ZoomControl />);
    shortcut();
    const slot = screen.getByTestId("zoom-control-slot");
    fireEvent.pointerEnter(slot);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerLeave(slot);
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
  });

  it("announces that the trigger opens a labelled dialog", () => {
    state.factor = 1.2;
    render(<ZoomControl />);
    const trigger = screen.getByTestId("zoom-control");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    const popup = screen.getByRole("dialog", { name: "Zoom level" });
    expect(trigger).toHaveAttribute("aria-controls", popup.id);
  });

  it("does not dim the button at a non-default zoom", () => {
    state.factor = 1.2;
    render(<ZoomControl />);
    expect(screen.getByTestId("zoom-control")).not.toHaveClass("opacity-50");
  });
});
