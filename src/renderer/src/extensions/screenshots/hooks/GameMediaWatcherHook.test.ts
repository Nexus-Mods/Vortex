/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import useGameMediaWatcher from "./GameMediaWatcherHook";

const { watcher, mockWatch, mockOnSourceChanged } = vi.hoisted(() => {
  const watcher = { close: vi.fn() };

  return {
    watcher,
    mockWatch: vi.fn((_path: string, _cb: () => void) => watcher),
    mockOnSourceChanged: vi.fn((_sourceId: string) => {}),
  };
});

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, default: { ...actual.default, watch: mockWatch } };
});

const render = (sources = {}, disabled: string[] = [], onSourceChanged = mockOnSourceChanged) =>
  renderHook(
    ({ sources, disabled, onSourceChanged }) =>
      useGameMediaWatcher(sources, disabled, onSourceChanged),
    { initialProps: { sources, disabled, onSourceChanged } },
  );

describe("GameMediaWatcherHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatch.mockReturnValue(watcher);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("watches every enabled source", () => {
    const sources = {
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    };

    render(sources);

    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenCalledWith("A", expect.any(Function));
    expect(mockWatch).toHaveBeenCalledWith("B", expect.any(Function));
  });

  it("skips disabled sources", () => {
    const sources = {
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    };

    render(sources, ["sourceA"]);

    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockWatch).not.toHaveBeenCalledWith("A", expect.any(Function));
    expect(mockWatch).toHaveBeenCalledWith("B", expect.any(Function));
  });

  it("debouces a burst into one callback", () => {
    vi.useFakeTimers();

    render({ sourceA: { name: "Source A", path: "A" } });

    const onChange = mockWatch.mock.calls[0][1];
    onChange();
    onChange();
    onChange();

    expect(mockOnSourceChanged).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(mockOnSourceChanged).toHaveBeenCalledOnce();
    expect(mockOnSourceChanged).toHaveBeenCalledWith("sourceA");

    vi.useRealTimers();
  });

  it("closes every watcher on unmount", async () => {
    const sources = {
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    };

    const hook = render(sources);
    await waitFor(() => expect(mockWatch).toHaveBeenCalledTimes(2));

    hook.unmount();

    expect(watcher.close).toHaveBeenCalledTimes(2);
  });

  it("does not rebuild watchers on re-render with the same inputs", async () => {
    const sources = {
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    };
    const disabled = [];

    const hook = render(sources, disabled, mockOnSourceChanged);
    await waitFor(() => expect(mockWatch).toHaveBeenCalledTimes(2));

    hook.rerender({ sources, disabled, onSourceChanged: mockOnSourceChanged });

    expect(watcher.close).not.toHaveBeenCalled();
  });

  it("survives an unwatchable source", () => {
    const sources = {
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    };
    mockWatch.mockImplementationOnce(() => {
      throw new Error("EPERM");
    });

    render(sources);

    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenLastCalledWith("B", expect.any(Function));
  });
});
