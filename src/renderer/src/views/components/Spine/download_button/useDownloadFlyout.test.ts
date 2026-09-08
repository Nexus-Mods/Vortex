import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTO_DISMISS_MS, useDownloadFlyout } from "./useDownloadFlyout.hook";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDownloadFlyout", () => {
  it("says nothing while there is nothing downloading", () => {
    const { result } = renderHook(() => useDownloadFlyout([]));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.downloadId).toBeUndefined();
  });

  it("stays shut for downloads already in flight when it mounts", () => {
    // A session resuming mid-download has no news to announce.
    const { result } = renderHook(() => useDownloadFlyout(["dl1"]));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.downloadId).toBe("dl1");
  });

  it("announces a download that arrives after it mounted", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.downloadId).toBe("dl1");
  });

  it("names the download that just arrived, not the one already running", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: ["dl1"] },
    });

    act(() => rerender({ ids: ["dl1", "dl2"] }));

    expect(result.current.downloadId).toBe("dl2");
  });

  it("gets out of the way on its own", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    expect(result.current.isOpen).toBe(true);

    act(() => vi.advanceTimersByTime(AUTO_DISMISS_MS));
    expect(result.current.isOpen).toBe(false);
  });

  it("does not snatch itself away from a pointer that opened it", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => result.current.onOpenChange(true, "hover"));
    act(() => rerender({ ids: ["dl1"] }));

    act(() => vi.advanceTimersByTime(AUTO_DISMISS_MS));
    expect(result.current.isOpen).toBe(true);
  });

  it("drops its countdown once the user takes it over", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    act(() => result.current.onOpenChange(true, "hover"));

    act(() => vi.advanceTimersByTime(AUTO_DISMISS_MS));
    expect(result.current.isOpen).toBe(true);
  });

  it("closes when the user dismisses it", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    act(() => result.current.onOpenChange(false, "escape-key"));

    expect(result.current.isOpen).toBe(false);
  });

  it("marks itself as announcing, so nothing the user does elsewhere takes it down", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });
    expect(result.current.isAnnouncing).toBe(false);

    act(() => rerender({ ids: ["dl1"] }));

    expect(result.current.isAnnouncing).toBe(true);
  });

  it("stops announcing once it has had its say", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    act(() => vi.advanceTimersByTime(AUTO_DISMISS_MS));

    expect(result.current.isAnnouncing).toBe(false);
  });

  it("hands over to the pointer, so it behaves like any other tooltip from then on", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    expect(result.current.isAnnouncing).toBe(true);

    act(() => result.current.onOpenChange(true, "hover"));

    expect(result.current.isAnnouncing).toBe(false);
    expect(result.current.isOpen).toBe(true);
  });

  it("keeps naming something real when the download it named finishes", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1", "dl2"] }));
    expect(result.current.downloadId).toBe("dl1");

    act(() => rerender({ ids: ["dl2"] }));
    expect(result.current.downloadId).toBe("dl2");
  });

  // The panel is still on screen for its exit transition when the queue empties, so
  // dropping the name here made the content flick back to the plain label before closing.
  it("keeps naming the download it announced while the panel closes", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    act(() => rerender({ ids: [] }));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.downloadId).toBe("dl1");
  });

  it("forgets it once opened again with nothing downloading", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    act(() => rerender({ ids: [] }));
    act(() => result.current.onOpenChange(true, "hover"));

    expect(result.current.downloadId).toBeUndefined();
  });

  it("falls silent once the last download is done", () => {
    const { rerender, result } = renderHook(({ ids }) => useDownloadFlyout(ids), {
      initialProps: { ids: [] as string[] },
    });

    act(() => rerender({ ids: ["dl1"] }));
    act(() => rerender({ ids: [] }));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isAnnouncing).toBe(false);
  });
});
