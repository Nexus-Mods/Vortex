import { describe, expect, it } from "vitest";

import type { IState } from "../../../../types/IState";
import { categoryChoices } from "./categoryChoices";

const state = {
  settings: {
    interface: { hideTopLevelCategory: false },
    profiles: { activeProfileId: "profile" },
  },
  persistent: {
    profiles: { profile: { gameId: "game" } },
    categories: {
      game: {
        "1": { name: "Armour", parentCategory: undefined, order: 2 },
        "2": { name: "Heavy", parentCategory: "1", order: 3 },
        "3": { name: "Audio", parentCategory: undefined, order: 1 },
      },
    },
  },
} as unknown as IState;

describe("categoryChoices", () => {
  it("lists the active game's categories by their paths, in the user's order", () => {
    expect(categoryChoices(state)).toEqual([
      { value: "3", label: "Audio" },
      { value: "1", label: "Armour" },
      { value: "2", label: "Armour --> Heavy" },
    ]);
  });
});

describe("categoryChoices, memoized", () => {
  it("gives the same choices while the categories don't change", () => {
    expect(categoryChoices(state)).toBe(categoryChoices({ ...state } as IState));
  });

  it("returns the same choices on every call while the game has no categories", () => {
    const empty = {
      ...state,
      persistent: { ...state.persistent, categories: {} },
    } as unknown as IState;

    expect(categoryChoices(empty)).toBe(categoryChoices({ ...empty } as IState));
  });

  it("leaves the top level out of a child's path where the user hides it", () => {
    const hidden = {
      ...state,
      settings: { ...state.settings, interface: { hideTopLevelCategory: true } },
    } as unknown as IState;

    expect(categoryChoices(hidden)).toContainEqual({ value: "2", label: "Heavy" });
  });
});
