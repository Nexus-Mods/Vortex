import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createBrowseModsTracker, type ISearchEventProps } from "./browseModsTracker";

/** A search, as the search events send it. */
const SEARCHED: ISearchEventProps = {
  view: "trending",
  sort_field: "endorsements",
  sort_direction: "desc",
  has_search: false,
  time_range: "7",
  adult: "exclude",
};

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

  it("counts an empty state's Remove filters, by its state and how many it cleared", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackEmptyStateFiltersRemoved({
      view: "trending",
      state: "filters_only",
      filter_count: 2,
    });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_empty_state_filters_removed",
      properties: { view: "trending", state: "filters_only", filter_count: 2 },
    });
  });

  it("counts an empty state's Search on website, by its state", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackEmptyStateWebsiteSearchOpened({ view: "popular", state: "end_of_results" });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_empty_state_website_search_opened",
      properties: { view: "popular", state: "end_of_results" },
    });
  });

  it("counts an empty state's Learn more, by its state", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackEmptyStateLearnMoreOpened({ view: "custom", state: "nothing_for_game" });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_empty_state_learn_more_opened",
      properties: { view: "custom", state: "nothing_for_game" },
    });
  });

  it("counts a search by how long it is, not what it says", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackSearchSubmitted({ view: "trending", query_length: 6 });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_search_submitted",
      properties: { view: "trending", query_length: 6 },
    });
  });

  it("counts clearing the search, by where it was cleared from", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackSearchCleared({ view: "new", source: "empty_state" });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_search_cleared",
      properties: { view: "new", source: "empty_state" },
    });
  });

  it.each([
    ["trackModLinkCopied", "browse_mods_mod_link_copied"],
    ["trackModReportOpened", "browse_mods_mod_report_opened"],
  ] as const)("counts %s from the details' menu, by its mod", (method, eventName) => {
    const { emit, tracker } = trackerOnSpy();

    tracker[method]({ mod_uid: "1704-1" });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName,
      properties: { mod_uid: "1704-1" },
    });
  });

  it("counts feedback skipped, with no reasons", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackFeedbackGiven({
      ...SEARCHED,
      pages_loaded: 1,
      sentiment: "positive",
      source: "toolbar",
    });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_feedback_given",
      properties: { ...SEARCHED, pages_loaded: 1, sentiment: "positive", source: "toolbar" },
    });
  });

  it("counts feedback sent, with its reasons", () => {
    const { emit, tracker } = trackerOnSpy();

    tracker.trackFeedbackGiven({
      ...SEARCHED,
      pages_loaded: 3,
      sentiment: "negative",
      source: "load_more",
      reasons: ["slow"],
    });

    expect(emit).toHaveBeenCalledWith("analytics-track-mixpanel-event", {
      eventName: "browse_mods_feedback_given",
      properties: {
        ...SEARCHED,
        pages_loaded: 3,
        sentiment: "negative",
        source: "load_more",
        reasons: ["slow"],
      },
    });
  });
});
