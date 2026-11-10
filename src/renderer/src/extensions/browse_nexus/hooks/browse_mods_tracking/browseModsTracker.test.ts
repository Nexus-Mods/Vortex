import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createBrowseModsTracker } from "./browseModsTracker";

/** A tracker on a spied bus. */
const trackerOnSpy = () => {
  const emit = vi.fn();
  return {
    emit,
    tracker: createBrowseModsTracker({ events: { emit } } as unknown as IExtensionApi),
  };
};

describe("createBrowseModsTracker", () => {
  it("sends each event on the analytics bus, by name with its properties", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackModSelected({
      mod_uid: "7340033",
      view: "trending",
      position: 3,
      input: "pointer",
    });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_mod_selected",
      properties: { mod_uid: "7340033", view: "trending", position: 3, input: "pointer" },
    });
  });

  it("sends an event without properties with none", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackViewed();

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_viewed",
      properties: {},
    });
  });

  it("leaves out properties that are undefined, rather than sending them empty", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackModPageOpened({ mod_uid: undefined as unknown as string });

    expect(emit.mock.calls[0][1].properties).toEqual({});
  });
});
