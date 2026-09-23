import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZOOM_SHORTCUT_EVENT } from "@/util/zoom";

import { ZoomControl } from "./ZoomControl";

const state = vi.hoisted(() => ({ factor: 1 }));
vi.mock("react-redux", () => ({ useSelector: () => state.factor, useDispatch: () => vi.fn() }));

function scroll(ctrlKey = true) {
  fireEvent(window, new Event(ctrlKey ? ZOOM_SHORTCUT_EVENT : "wheel"));
}

beforeEach(() => {
  vi.useFakeTimers();
  state.factor = 1;
});
afterEach(() => vi.useRealTimers());

describe("ZoomControl", () => {
  it("hides the default zoom button until a wheel gesture, then shows it muted", () => {
    render(<ZoomControl />);
    expect(screen.queryByTestId("zoom-control")).not.toBeInTheDocument();
    scroll();
    const button = screen.getByTestId("zoom-control");
    expect(button).toHaveClass("opacity-50");
    expect(button).toBeEnabled();
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
  });

  it("starts closing three seconds after the last scroll, then finishes its exit transition", async () => {
    render(<ZoomControl />);
    scroll();
    expect(screen.getByTestId("zoom-popover")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    scroll();
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
    scroll(false);
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
  });

  it("reopens during the exit animation when another shortcut arrives", async () => {
    render(<ZoomControl />);
    scroll();
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
    scroll();
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
    fireEvent.click(screen.getByRole("button", { name: "common:zoom.in" }));
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
    fireEvent.click(screen.getByRole("button", { name: "common:zoom.reset" }));
    state.factor = 1;
    rerender(<ZoomControl />);
    await act(async () => vi.advanceTimersByTimeAsync(2999));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "true");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("zoom-control")).toHaveAttribute("aria-expanded", "false");
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(screen.queryByTestId("zoom-popover")).not.toBeInTheDocument();
  });

  it("does not dim the button at a non-default zoom", () => {
    state.factor = 1.2;
    render(<ZoomControl />);
    expect(screen.getByTestId("zoom-control")).not.toHaveClass("opacity-50");
  });
});
