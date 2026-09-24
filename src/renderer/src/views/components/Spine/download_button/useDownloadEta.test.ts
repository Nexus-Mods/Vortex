import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DownloadState, IDownload } from "@/extensions/download_management/types/IDownload";

import { type DownloadEta, useDownloadEta } from "./useDownloadEta.hook";

const download = (
  received: number,
  { size = 1000, state = "started" }: { size?: number; state?: DownloadState } = {},
): IDownload => ({ id: "dl1", received, size, state }) as unknown as IDownload;

const renderEta = (initial: IDownload | undefined) =>
  renderHook(({ dl }) => useDownloadEta(dl), { initialProps: { dl: initial } });

/** The seconds on a ready estimate, or the status when there isn't one to read. */
const seconds = (eta: DownloadEta): number | string =>
  eta.status === "ready" ? eta.seconds : eta.status;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDownloadEta", () => {
  it("has nothing to say without a download", () => {
    const { result } = renderEta(undefined);
    expect(result.current.status).toBe("unavailable");
  });

  it("reports that it is still working an estimate out", () => {
    const { result } = renderEta(download(0));
    expect(result.current.status).toBe("estimating");
  });

  it("estimates from the bytes that arrived between two readings", () => {
    const { rerender, result } = renderEta(download(0));

    act(() => {
      vi.advanceTimersByTime(1000);
      rerender({ dl: download(100) });
    });

    // 100 bytes in a second, 900 to go.
    expect(seconds(result.current)).toBeCloseTo(9, 3);
  });

  it("smooths the rate rather than tracking every reading", () => {
    const { rerender, result } = renderEta(download(0));

    act(() => {
      vi.advanceTimersByTime(1000);
      rerender({ dl: download(100) });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
      rerender({ dl: download(300) });
    });

    // The rate doubled, but only 30% of that lands: 100 + 0.3 * (200 - 100) = 130 B/s.
    expect(seconds(result.current)).toBeCloseTo(700 / 130, 3);
  });

  it("ignores readings too close together to mean anything", () => {
    const { rerender, result } = renderEta(download(0));

    act(() => {
      vi.advanceTimersByTime(100);
      rerender({ dl: download(100) });
    });

    expect(result.current.status).toBe("estimating");
  });

  it("adds up readings that are each too close, rather than dropping them all", () => {
    const { rerender, result } = renderEta(download(0));

    // Two 200ms ticks: neither clears the threshold alone, together they do.
    act(() => {
      vi.advanceTimersByTime(200);
      rerender({ dl: download(50) });
    });
    act(() => {
      vi.advanceTimersByTime(200);
      rerender({ dl: download(100) });
    });

    // 100 bytes over 400ms is 250 B/s, so 900 bytes take 3.6s.
    expect(seconds(result.current)).toBeCloseTo(3.6, 3);
  });

  it("stops estimating while a download is paused", () => {
    const { rerender, result } = renderEta(download(0));

    act(() => {
      vi.advanceTimersByTime(1000);
      rerender({ dl: download(100) });
    });
    expect(seconds(result.current)).toBeCloseTo(9, 3);

    // Not "estimating": a paused download is not on its way, and the flyout would
    // otherwise sit on "Download starting..." for as long as it stayed paused. The pause
    // replaces the estimate rather than leaving the last one standing.
    act(() => rerender({ dl: download(100, { state: "paused" }) }));
    expect(result.current).toEqual({ status: "paused", percentRemaining: 90 });
  });

  it("says nothing when the server never sent a size", () => {
    const { rerender, result } = renderEta(download(0, { size: 0 }));

    act(() => {
      vi.advanceTimersByTime(1000);
      rerender({ dl: download(100, { size: 0 }) });
    });

    // Running with no size means one is never coming, so this is not pending.
    expect(result.current.status).toBe("unavailable");
  });

  it("starts over when it is pointed at a different download", () => {
    const { rerender, result } = renderEta(download(0));

    act(() => {
      vi.advanceTimersByTime(1000);
      rerender({ dl: download(100) });
    });
    expect(seconds(result.current)).toBeCloseTo(9, 3);

    act(() => rerender({ dl: { ...download(500), id: "dl2" } }));
    expect(result.current.status).toBe("estimating");
  });

  it("counts a download that has not moved yet as still starting", () => {
    const { result } = renderEta(download(0, { size: 0, state: "init" }));

    // A missing size during `init` is one the first progress hasn't reported yet, unlike
    // a running download whose server never sends one.
    expect(result.current.status).toBe("estimating");
  });

  it.each(["finalizing", "finished", "failed"] as DownloadState[])(
    "has no estimate to make once a download is %s",
    (state) => {
      const { rerender, result } = renderEta(download(0));

      act(() => {
        vi.advanceTimersByTime(1000);
        rerender({ dl: download(100) });
      });
      expect(seconds(result.current)).toBeCloseTo(9, 3);

      act(() => rerender({ dl: download(1000, { state }) }));
      expect(result.current.status).toBe("unavailable");
    },
  );

  // A paused download keeps its place in the flyout: the bytes still say how much is left,
  // even though the rate that would turn that into a time is gone.
  describe("paused", () => {
    it("reports the percent still to fetch", () => {
      const { result } = renderEta(download(750, { state: "paused" }));

      expect(result.current).toEqual({ status: "paused", percentRemaining: 25 });
    });

    it("rounds up, so outstanding bytes never read as none left", () => {
      const { result } = renderEta(download(999, { state: "paused" }));

      expect(result.current).toEqual({ status: "paused", percentRemaining: 1 });
    });

    it("has no percent to give when the server sent no size", () => {
      const { result } = renderEta(download(750, { size: 0, state: "paused" }));

      expect(result.current).toEqual({ status: "paused", percentRemaining: undefined });
    });
  });
});
