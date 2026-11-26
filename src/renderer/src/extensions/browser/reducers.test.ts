import { describe, expect, it } from "vitest";

import type { IBrowserState } from "@/types/IState";

import * as actions from "./actions";
import { sessionReducer } from "./reducers";

const defaults: IBrowserState = {
  url: undefined,
  instructions: undefined,
  subscriber: undefined,
  skippable: undefined,
};

describe("showURL", () => {
  it("sets all properties when called", () => {
    const payload = actions.showURL("http://example.com", "Follow these.", "sub-1", true).payload;
    const result = sessionReducer.reducers.SHOW_URL(defaults, payload);
    expect(result).toEqual({
      url: "http://example.com",
      instructions: "Follow these.",
      subscriber: "sub-1",
      skippable: true,
    });
  });
});

describe("closeBrowser", () => {
  it("clears the URL and leaves other properties unchanged", () => {
    const initialState = { ...defaults, url: "http://example.com", instructions: "Follow these." };
    const result = sessionReducer.reducers.CLOSE_BROWSER(initialState, undefined);

    expect(result).toEqual({ ...defaults, url: undefined, instructions: "Follow these." });
    expect(initialState).toEqual({
      ...defaults,
      url: "http://example.com",
      instructions: "Follow these.",
    });
  });
});
