import { act, renderHook } from "@testing-library/react";
import type * as ReactReduxTypes from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The stored override, flipped per test and read through the mocked hook. */
const settings = vi.hoisted(() => ({
  interface: {} as { reduceMotion?: boolean },
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useSelector: (selector: (state: unknown) => unknown) => selector({ settings }),
  };
});

import { applyReduceMotion, isReduceMotionActive, useReduceMotion } from "./reduceMotion";

/**
 * A MediaQueryList the test drives. `set` flips the answer and notifies listeners the way
 * the OS does when its accessibility setting changes.
 */
const osPreference = () => {
  const listeners = new Set<() => void>();
  let matches = false;

  window.matchMedia = ((media: string) => ({
    get matches() {
      return matches;
    },
    media,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;

  return {
    set: (value: boolean) => {
      matches = value;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
};

const originalMatchMedia = window.matchMedia;

describe("useReduceMotion", () => {
  let os: ReturnType<typeof osPreference>;

  beforeEach(() => {
    settings.interface = {};
    os = osPreference();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("follows the OS while the user has made no choice", () => {
    const { result } = renderHook(() => useReduceMotion());

    expect(result.current).toBe(false);

    act(() => os.set(true));

    expect(result.current).toBe(true);
  });

  // The whole point of the setting: someone whose OS says nothing, or says the opposite
  // of what they want in Vortex, gets to decide.
  it("lets the user's choice win over the OS, in both directions", () => {
    settings.interface.reduceMotion = true;
    const { result: on } = renderHook(() => useReduceMotion());

    expect(on.current).toBe(true);

    settings.interface.reduceMotion = false;
    act(() => os.set(true));
    const { result: off } = renderHook(() => useReduceMotion());

    expect(off.current).toBe(false);
  });

  it("stops listening to the OS once unmounted", () => {
    const { unmount } = renderHook(() => useReduceMotion());

    expect(os.listenerCount()).toBe(1);

    unmount();

    expect(os.listenerCount()).toBe(0);
  });
});

describe("applyReduceMotion", () => {
  afterEach(() => applyReduceMotion(false));

  // The attribute is what the stylesheets key off, and what isReduceMotionActive reads,
  // so the two never disagree.
  it("publishes the preference on the root element", () => {
    applyReduceMotion(true);

    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    expect(isReduceMotionActive()).toBe(true);
  });

  it("removes the attribute rather than setting it false", () => {
    applyReduceMotion(true);
    applyReduceMotion(false);

    expect(document.documentElement.hasAttribute("data-reduce-motion")).toBe(false);
    expect(isReduceMotionActive()).toBe(false);
  });
});
