import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUnsavedDraft } from "./useUnsavedDraft.hook";

describe("useUnsavedDraft", () => {
  it("starts as the value", () => {
    const { result } = renderHook(() => useUnsavedDraft("Kept", vi.fn()));

    expect(result.current.draft).toBe("Kept");
  });

  it("saves what's typed once asked, and only once", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useUnsavedDraft("", onSave));

    act(() => result.current.change("Typed"));
    act(() => result.current.save());
    act(() => result.current.save());

    expect(result.current.draft).toBe("Typed");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Typed");
  });

  it("saves nothing where nothing was typed", () => {
    const onSave = vi.fn();
    const { result, unmount } = renderHook(() => useUnsavedDraft("Kept", onSave));

    act(() => result.current.save());
    unmount();

    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves typing left unsaved on the way out, with the save it was last given", () => {
    const first = vi.fn();
    const last = vi.fn();
    const { result, rerender, unmount } = renderHook(({ onSave }) => useUnsavedDraft("", onSave), {
      initialProps: { onSave: first },
    });

    act(() => result.current.change("Typed"));
    rerender({ onSave: last });
    unmount();

    expect(first).not.toHaveBeenCalled();
    expect(last).toHaveBeenCalledWith("Typed");
  });
});
