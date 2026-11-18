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

  it("follows a new value while nothing is typed", () => {
    const { result, rerender } = renderHook(({ value }) => useUnsavedDraft(value, vi.fn()), {
      initialProps: { value: "Before" },
    });

    rerender({ value: "After" });

    expect(result.current.draft).toBe("After");
  });

  it("keeps what's typed, unsaved, when the value changes", () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useUnsavedDraft(value, onSave), {
      initialProps: { value: "" },
    });

    act(() => result.current.change("hel"));
    rerender({ value: "elsewhere" });

    expect(result.current.draft).toBe("hel");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("settles on what was saved when it comes back as the value, saving nothing more", () => {
    const onSave = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useUnsavedDraft(value, onSave),
      { initialProps: { value: "" } },
    );

    act(() => result.current.change("Typed"));
    act(() => result.current.save());
    rerender({ value: "Typed" });
    unmount();

    expect(result.current.draft).toBe("Typed");
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
