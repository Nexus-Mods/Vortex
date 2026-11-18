import { describe, expect, test } from "vitest";

import * as actions from "../actions/userlist";
import type { ILOOTList } from "../types/ILOOTList";
import userlistReducer from "./userlist";

// invoke a single case of the reducer spec by the action it handles
function reduce(state: ILOOTList, action: { type: string; payload?: unknown }) {
  return userlistReducer.reducers[action.type](state, action.payload);
}

const list = (overrides: Partial<ILOOTList> = {}): ILOOTList => ({
  plugins: [],
  groups: [],
  ...overrides,
});

describe("userlistReducer", () => {
  describe("addRule", () => {
    test("creates the plugin entry with the rule in the list for its type", () => {
      const next = reduce(list(), actions.addRule("A.esp", "B.esp", "requires"));

      expect(next.plugins).toEqual([{ name: "A.esp", req: ["B.esp"] }]);
    });

    test("puts any unknown type in the after list", () => {
      const next = reduce(list(), actions.addRule("A.esp", "B.esp", "after"));

      expect(next.plugins).toEqual([{ name: "A.esp", after: ["B.esp"] }]);
    });

    test("appends to an existing plugin matched case-insensitively", () => {
      const state = list({ plugins: [{ name: "A.esp", inc: ["B.esp"] }] });

      const next = reduce(state, actions.addRule("a.ESP", "C.esp", "incompatible"));

      expect(next.plugins).toEqual([{ name: "A.esp", inc: ["B.esp", "C.esp"] }]);
    });

    test("returns the same state when the rule already exists", () => {
      const state = list({ plugins: [{ name: "A.esp", after: ["B.esp"] }] });

      expect(reduce(state, actions.addRule("A.esp", "B.esp", "after"))).toBe(state);
    });
  });

  describe("removeRule", () => {
    test("removes a name rule case-insensitively, leaving the others", () => {
      const state = list({ plugins: [{ name: "A.esp", after: ["B.esp", "C.esp"] }] });

      const next = reduce(state, actions.removeRule("A.esp", "b.ESP", "after"));

      expect(next.plugins).toEqual([{ name: "A.esp", after: ["C.esp"] }]);
    });

    test("removes a reference rule by its name", () => {
      const state = list({
        plugins: [{ name: "A.esp", req: [{ name: "B.esp", display: "B", condition: "x" }] }],
      });

      const next = reduce(state, actions.removeRule("A.esp", "B.esp", "requires"));

      expect(next.plugins).toEqual([{ name: "A.esp", req: [] }]);
    });

    test("returns the same state for an unknown plugin", () => {
      const state = list({ plugins: [{ name: "A.esp", after: ["B.esp"] }] });

      expect(reduce(state, actions.removeRule("X.esp", "B.esp", "after"))).toBe(state);
    });
  });

  describe("groups", () => {
    test("addGroup adds a group once, matching names case-insensitively", () => {
      const once = reduce(list(), actions.addGroup("Late"));

      expect(once.groups).toEqual([{ name: "Late", after: [] }]);
      expect(reduce(once, actions.addGroup("late"))).toBe(once);
    });

    test("addGroupRule creates the group when missing and dedupes rules", () => {
      const created = reduce(list(), actions.addGroupRule("Late", "Early"));
      expect(created.groups).toEqual([{ name: "Late", after: ["Early"] }]);

      const appended = reduce(created, actions.addGroupRule("late", "Mid"));
      expect(appended.groups).toEqual([{ name: "Late", after: ["Early", "Mid"] }]);

      expect(reduce(appended, actions.addGroupRule("Late", "Mid"))).toBe(appended);
    });

    test("removeGroupRule removes the rule and ignores an unknown group", () => {
      const state = list({ groups: [{ name: "Late", after: ["Early", "Mid"] }] });

      const next = reduce(state, actions.removeGroupRule("Late", "Early"));

      expect(next.groups).toEqual([{ name: "Late", after: ["Mid"] }]);
      expect(reduce(state, actions.removeGroupRule("Nope", "Early"))).toBe(state);
    });

    test("removeGroup drops the group, its use in other groups' rules and plugins' membership", () => {
      const state = list({
        groups: [
          { name: "Early", after: [] },
          { name: "Late", after: ["Early"] },
        ],
        plugins: [
          { name: "A.esp", group: "early" },
          { name: "B.esp", group: "Late" },
        ],
      });

      const next = reduce(state, actions.removeGroup("Early"));

      expect(next.groups).toEqual([{ name: "Late", after: [] }]);
      expect(next.plugins).toEqual([
        { name: "A.esp", group: "default" },
        { name: "B.esp", group: "Late" },
      ]);
      expect(state.groups[1].after).toEqual(["Early"]);
    });
  });

  describe("setGroup", () => {
    test("assigns a group, creating the plugin entry when missing", () => {
      const next = reduce(list(), actions.setGroup("A.esp", "Late"));

      expect(next.plugins).toEqual([{ name: "A.esp", group: "Late" }]);
    });

    test("clears the group when passed undefined", () => {
      const state = list({ plugins: [{ name: "A.esp", group: "Late", after: ["B.esp"] }] });

      const next = reduce(state, actions.setGroup("A.esp", undefined));

      expect(next.plugins).toEqual([{ name: "A.esp", after: ["B.esp"] }]);
    });

    test("returns the same state when clearing a group that isn't set", () => {
      const state = list({ plugins: [{ name: "A.esp" }] });

      expect(reduce(state, actions.setGroup("A.esp", undefined))).toBe(state);
    });
  });

  test("clearUserlist empties plugins and groups", () => {
    const state = list({ plugins: [{ name: "A.esp" }], groups: [{ name: "Late" }] });

    expect(reduce(state, actions.clearUserlist())).toEqual({ plugins: [], groups: [] });
  });

  describe("persist/REHYDRATE", () => {
    test("replaces the state with the rehydrated userlist", () => {
      const userlist = list({ plugins: [{ name: "A.esp" }] });

      const next = reduce(list(), { type: "persist/REHYDRATE", payload: { userlist } });

      expect(next).toEqual(userlist);
      expect(next).not.toBe(userlist);
    });

    test("keeps the state when the payload has no userlist", () => {
      const state = list();

      expect(reduce(state, { type: "persist/REHYDRATE", payload: {} })).toBe(state);
    });
  });
});
