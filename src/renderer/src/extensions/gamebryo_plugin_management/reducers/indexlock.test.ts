import { describe, expect, test } from "vitest";

import { lockPluginIndex } from "../actions/indexlock";
import { indexReducer, type ILockedIndices } from "./indexlock";

// invoke a single case of the reducer spec by the action it handles
function reduce(state: ILockedIndices, action: { type: string; payload: unknown }): ILockedIndices {
  return indexReducer.reducers[action.type](state, action.payload);
}

describe("indexReducer", () => {
  test("keys a locked index by the plugin id whatever spelling arrives", () => {
    const locked = reduce({}, lockPluginIndex("skyrimse", "MixedCase.esp", 5));
    const both = reduce(locked, lockPluginIndex("skyrimse", "Ghosted.esp.ghost", 7));

    expect(both).toEqual({ skyrimse: { "mixedcase.esp": 5, "ghosted.esp": 7 } });
  });

  test("clears a lock by plugin id whatever spelling arrives", () => {
    const state = { skyrimse: { "c.esp": 1, "d.esp": 2 } };

    expect(reduce(state, lockPluginIndex("skyrimse", "C.ESP", undefined))).toEqual({
      skyrimse: { "d.esp": 2 },
    });
  });

  test("keeps the state when a lock does not change", () => {
    const state = { skyrimse: { "c.esp": 1 } };

    expect(reduce(state, lockPluginIndex("skyrimse", "c.esp", 1))).toBe(state);
    expect(reduce(state, lockPluginIndex("skyrimse", "unlocked.esp", undefined))).toBe(state);
  });
});
