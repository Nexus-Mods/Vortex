import type { WebContents } from "electron";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../ipc", () => ({
  betterIpcMain: { send: vi.fn() },
}));

import { betterIpcMain } from "../ipc";
import { createProgressSender } from "./progress";

const send = vi.mocked(betterIpcMain.send);

function makeWebContents(destroyed = false): WebContents {
  return { isDestroyed: () => destroyed } as unknown as WebContents;
}

const MB = 1024 * 1024;

describe("createProgressSender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it("coalesces the chunk-by-chunk events got emits", () => {
    const report = createProgressSender(makeWebContents(), 7, 100 * MB);

    // 64 KiB writes, well under the byte threshold and inside one interval.
    for (let sent = 65536; sent <= 512 * 1024; sent += 65536) {
      report(sent);
    }

    // Only the first is sent; the rest are neither a big enough jump nor late
    // enough to warrant their own IPC message.
    expect(send).toHaveBeenCalledOnce();
  });

  it("sends once a meaningful number of bytes has moved", () => {
    const report = createProgressSender(makeWebContents(), 7, 100 * MB);

    report(0);
    report(2 * MB);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(expect.anything(), "upload:progress", {
      uploadId: 7,
      transferred: 2 * MB,
      total: 100 * MB,
    });
  });

  it("sends on a slow trickle once the interval has passed", () => {
    const report = createProgressSender(makeWebContents(), 7, 100 * MB);

    report(1024);
    vi.advanceTimersByTime(300);
    report(2048);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("always sends the final value so the bar lands on complete", () => {
    const total = 10 * MB;
    const report = createProgressSender(makeWebContents(), 7, total);

    report(0);
    // A small final chunk: too small a jump and too soon, but it completes.
    report(total);

    expect(send).toHaveBeenLastCalledWith(expect.anything(), "upload:progress", {
      uploadId: 7,
      transferred: total,
      total,
    });
  });

  it("never repeats an identical byte count", () => {
    const total = 10 * MB;
    const report = createProgressSender(makeWebContents(), 7, total);

    report(total);
    report(total);

    expect(send).toHaveBeenCalledOnce();
  });

  it("stops sending to a destroyed renderer", () => {
    const report = createProgressSender(makeWebContents(true), 7, 10 * MB);

    report(5 * MB);

    expect(send).not.toHaveBeenCalled();
  });
});
