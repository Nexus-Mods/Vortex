import { describe, it, expect } from "vitest";

import { toolbarReducer } from "./toolbars";

describe("setActionPinned", () => {
  it("records an action as pinned", () => {
    const result = toolbarReducer.reducers.SET_TOOLBAR_ACTION_PINNED(
      {},
      { toolbarId: "mods", actionId: "deploy", pinned: true },
    );
    expect(result).toEqual({ mods: { pinned: { deploy: true } } });
  });

  it("records an action as unpinned", () => {
    const result = toolbarReducer.reducers.SET_TOOLBAR_ACTION_PINNED(
      {},
      { toolbarId: "mods", actionId: "deploy", pinned: false },
    );
    expect(result).toEqual({ mods: { pinned: { deploy: false } } });
  });

  it("leaves the decisions already made about that toolbar alone", () => {
    const result = toolbarReducer.reducers.SET_TOOLBAR_ACTION_PINNED(
      { mods: { pinned: { deploy: true } } },
      { toolbarId: "mods", actionId: "purge", pinned: false },
    );
    expect(result).toEqual({ mods: { pinned: { deploy: true, purge: false } } });
  });

  it("leaves other toolbars alone", () => {
    const result = toolbarReducer.reducers.SET_TOOLBAR_ACTION_PINNED(
      { extensions: { pinned: { refresh: false } } },
      { toolbarId: "mods", actionId: "deploy", pinned: true },
    );
    expect(result).toEqual({
      extensions: { pinned: { refresh: false } },
      mods: { pinned: { deploy: true } },
    });
  });

  it("replaces an earlier decision about the same action", () => {
    const result = toolbarReducer.reducers.SET_TOOLBAR_ACTION_PINNED(
      { mods: { pinned: { deploy: false } } },
      { toolbarId: "mods", actionId: "deploy", pinned: true },
    );
    expect(result).toEqual({ mods: { pinned: { deploy: true } } });
  });
});

describe("resetPinnedActions", () => {
  it("forgets the toolbar entirely, rather than recording it as empty", () => {
    const result = toolbarReducer.reducers.RESET_TOOLBAR_PINNED_ACTIONS(
      { mods: { pinned: { deploy: false, purge: true } } },
      { toolbarId: "mods" },
    );
    expect(result).toEqual({});
  });

  it("leaves other toolbars alone", () => {
    const result = toolbarReducer.reducers.RESET_TOOLBAR_PINNED_ACTIONS(
      {
        extensions: { pinned: { refresh: false } },
        mods: { pinned: { deploy: false } },
      },
      { toolbarId: "mods" },
    );
    expect(result).toEqual({ extensions: { pinned: { refresh: false } } });
  });

  it("is harmless for a toolbar with no decisions recorded", () => {
    const result = toolbarReducer.reducers.RESET_TOOLBAR_PINNED_ACTIONS({}, { toolbarId: "mods" });
    expect(result).toEqual({});
  });
});
