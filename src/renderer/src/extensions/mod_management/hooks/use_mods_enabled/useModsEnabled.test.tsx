import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModWithState } from "../../types/IModProps";
import { useModsEnabled } from "./useModsEnabled.hook";

// --- Helpers ---

const mod = (id: string, enabled = false) => ({ id, enabled }) as IModWithState;

/** A change that lands or fails when the test says. */
const deferred = () => {
  let resolve: () => void = () => undefined;
  let reject: () => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const render = (
  onSetModsEnabled: (ids: string[], enabled: boolean) => PromiseLike<unknown> | void,
  modState?: { [modId: string]: { enabled: boolean } },
) => {
  const store = makeModsTableStore({ modState });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return renderHook(() => useModsEnabled(onSetModsEnabled), { wrapper });
};

// --- Tests ---

describe("useModsEnabled", () => {
  it("reads whether a mod is enabled from the profile before the mod", () => {
    const { result } = render(vi.fn(), { a: { enabled: true } });

    expect(result.current.isEnabled(mod("a", false))).toBe(true);
    expect(result.current.isEnabled(mod("b", true))).toBe(true);
  });

  it("shows a change at once, busy, until it lands", async () => {
    const change = deferred();
    const { result } = render(() => change.promise);

    act(() => result.current.setEnabled(["a"], true));

    expect(result.current.isEnabled(mod("a"))).toBe(true);
    expect(result.current.changing.has("a")).toBe(true);

    await act(async () => change.resolve());

    expect(result.current.changing.has("a")).toBe(false);
  });

  it("stops showing a change that fails", async () => {
    const change = deferred();
    const { result } = render(() => change.promise);

    act(() => result.current.setEnabled(["a"], true));
    await act(async () => change.reject());

    expect(result.current.changing.has("a")).toBe(false);
    expect(result.current.isEnabled(mod("a"))).toBe(false);
  });

  it("keeps showing a later change when an earlier one to the same mod lands", async () => {
    const first = deferred();
    const second = deferred();
    const changes = [first.promise, second.promise];
    const { result } = render(() => changes.shift());

    act(() => result.current.setEnabled(["a"], true));
    act(() => result.current.setEnabled(["a"], false));
    await act(async () => first.resolve());

    expect(result.current.changing.get("a")).toBe(false);
  });

  it("asks for no change without any mods", () => {
    const onSetModsEnabled = vi.fn();
    const { result } = render(onSetModsEnabled);

    act(() => result.current.setEnabled([], true));

    expect(onSetModsEnabled).not.toHaveBeenCalled();
  });
});
