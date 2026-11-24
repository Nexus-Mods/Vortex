import { describe, expect, it, vi } from "vitest";

import { InstallListeners, type InstallEvent } from "./installListeners";

const abandoned: InstallEvent = { type: "abandoned", error: new Error("stalled"), modId: "mod-a" };

describe("InstallListeners", () => {
  it("tells every listener, in the order they were added", () => {
    const listeners = new InstallListeners();
    const heard: string[] = [];
    listeners.add((event) => heard.push(`first:${event.type}`));
    listeners.add((event) => heard.push(`second:${event.type}`));

    listeners.emit(abandoned);

    expect(heard).toEqual(["first:abandoned", "second:abandoned"]);
  });

  it("stops telling a listener that was removed", () => {
    const listeners = new InstallListeners();
    const listener = vi.fn();
    const remove = listeners.add(listener);

    remove();
    listeners.emit(abandoned);

    expect(listener).not.toHaveBeenCalled();
  });

  // the install's slot is released by a listener that follows the caller's: a caller that throws
  // must not leave the slot held
  it("still tells the others when a listener throws, then rethrows the first error", () => {
    const listeners = new InstallListeners();
    const failure = new Error("listener failed");
    const later = vi.fn();
    listeners.add(() => {
      throw failure;
    });
    listeners.add(later);

    expect(() => listeners.emit(abandoned)).toThrow(failure);
    expect(later).toHaveBeenCalledWith(abandoned);
  });
});
