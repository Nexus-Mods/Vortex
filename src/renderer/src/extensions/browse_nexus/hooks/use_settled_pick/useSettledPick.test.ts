import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SETTLE_MS as DELAY,
  TAPPING_SETTLE_MS as TAPPING_DELAY,
  useSettledPick,
} from "./useSettledPick.hook";

const render = () => renderHook(() => useSettledPick<string>());

/** Moves the clock on, running the timers due. */
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Lets go of the key that was down. */
const release = () =>
  act(() => {
    fireEvent.keyUp(window, { key: "ArrowDown" });
  });

describe("useSettledPick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a pick from a key pressed and let go once it has rested for the delay", () => {
    const onShown = vi.fn();
    const { result } = render();

    act(() => result.current.pick("a", onShown));
    wait(50);
    release();

    expect(result.current.picked).toBe("a");
    wait(DELAY - 51);
    expect(result.current.shown).toBeUndefined();
    wait(1);
    expect(result.current.shown).toBe("a");
    expect(onShown).toHaveBeenCalledWith("a");
  });

  it("shows nothing while the key's held, however long, and the last pick once it's let go", () => {
    const onShown = vi.fn();
    const { result } = render();

    act(() => result.current.pick("a", onShown));
    wait(500);
    for (const value of ["b", "c", "d"]) {
      act(() => result.current.pick(value, onShown));
      wait(33);
    }
    wait(DELAY);

    expect(result.current.picked).toBe("d");
    expect(result.current.shown).toBeUndefined();
    release();
    expect(result.current.shown).toBe("d");
    expect(onShown.mock.calls).toEqual([["d"]]);
  });

  it("shows a tap after a pause at the short delay, and taps that follow only once they stop", () => {
    const onShown = vi.fn();
    const { result } = render();
    const tap = (value: string) => {
      act(() => result.current.pick(value, onShown));
      wait(50);
      release();
    };

    tap("a");
    wait(DELAY - 50);
    expect(result.current.shown).toBe("a");

    for (const value of ["b", "c", "d"]) {
      wait(150);
      tap(value);
    }
    wait(TAPPING_DELAY - 51);
    expect(result.current.shown).toBe("a");
    wait(1);

    expect(result.current.shown).toBe("d");
    expect(onShown.mock.calls).toEqual([["a"], ["d"]]);
  });

  it("goes back to the short delay for a tap well after the last", () => {
    const { result } = render();
    act(() => result.current.pick("a"));
    release();
    wait(1000);

    act(() => result.current.pick("b"));
    release();
    wait(DELAY);

    expect(result.current.shown).toBe("b");
  });

  it("shows a key held down soon after a tap at the short delay once it's let go", () => {
    const { result } = render();
    act(() => result.current.pick("a"));
    release();
    wait(DELAY);
    expect(result.current.shown).toBe("a");

    act(() => result.current.pick("b"));
    wait(500);
    for (const value of ["c", "d"]) {
      act(() => result.current.pick(value));
      wait(33);
    }
    release();
    expect(result.current.shown).toBe("a");
    wait(DELAY - 33);

    expect(result.current.shown).toBe("d");
  });

  it("waits out the delay after a key's let go too soon", () => {
    const { result } = render();
    act(() => result.current.pick("a"));

    release();
    wait(DELAY - 1);

    expect(result.current.shown).toBeUndefined();
    wait(1);
    expect(result.current.shown).toBe("a");
  });

  it("hears a key let go even when something stops its key-up on the way", () => {
    const { result } = render();
    const swallower = document.createElement("div");
    swallower.addEventListener("keyup", (event) => event.stopPropagation());
    document.body.append(swallower);
    act(() => result.current.pick("a"));
    wait(DELAY);

    act(() => {
      fireEvent.keyUp(swallower, { key: "ArrowDown" });
    });

    expect(result.current.shown).toBe("a");
    swallower.remove();
  });

  it("shows the pick waiting at once when flushed, as if it had settled", () => {
    const onShown = vi.fn();
    const { result } = render();
    act(() => result.current.pick("a", onShown));

    act(() => result.current.flush());

    expect(result.current.shown).toBe("a");
    expect(onShown).toHaveBeenCalledWith("a");
  });

  it("takes the window losing focus as letting go, as the key-up never comes", () => {
    const { result } = render();
    act(() => result.current.pick("a"));
    wait(DELAY);

    act(() => {
      fireEvent.blur(window);
    });

    expect(result.current.shown).toBe("a");
  });

  it("shows at once, instead of a pick waiting", () => {
    const onShown = vi.fn();
    const { result } = render();
    act(() => result.current.pick("a", onShown));

    act(() => result.current.show("b", onShown));
    release();
    wait(DELAY);

    expect(result.current.picked).toBe("b");
    expect(result.current.shown).toBe("b");
    expect(onShown.mock.calls).toEqual([["b"]]);
  });

  it("shows and counts nothing again for picking back the one shown", () => {
    const onShown = vi.fn();
    const { result } = render();
    act(() => result.current.show("a", onShown));

    act(() => result.current.pick("b", onShown));
    act(() => result.current.pick("a", onShown));
    release();
    wait(DELAY);

    expect(result.current.shown).toBe("a");
    expect(onShown.mock.calls).toEqual([["a"]]);
  });
});
