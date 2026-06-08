import { describe, expect, test } from "vitest";

import { removeGroupRule, setGroup } from "../actions/userlist";
import { ILOOTList } from "../types/ILOOTList";
import { IStateWithGamebryo } from "../types/IStateWithGamebryo";
import { missingGroupFixes } from "./groups";

// missingGroupFixes only reads state.masterlist and state.userlist, so we build a minimal
// state with just those slices and cast through unknown to the full state type.
function makeState(
  masterlist: Partial<ILOOTList> | undefined,
  userlist: Partial<ILOOTList> | undefined,
): IStateWithGamebryo {
  return { masterlist, userlist } as unknown as IStateWithGamebryo;
}

describe("missingGroupFixes", () => {
  test("returns nothing when there are no group references at all", () => {
    const state = makeState({ groups: [] }, { groups: [], plugins: [] });

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  test("ignores a plugin whose group exists in the masterlist", () => {
    const state = makeState(
      { groups: [{ name: "Fixes & Resources" }] },
      { groups: [], plugins: [{ name: "a.esp", group: "Fixes & Resources" }] },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  test("ignores a plugin whose group exists in the userlist", () => {
    const state = makeState(
      { groups: [] },
      {
        groups: [{ name: "Custom Group" }],
        plugins: [{ name: "a.esp", group: "Custom Group" }],
      },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  test("ignores plugins without a group assignment", () => {
    const state = makeState(
      { groups: [] },
      { groups: [], plugins: [{ name: "a.esp" }, { name: "b.esp" }] },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  test("resets a plugin assigned to a group missing from both lists", () => {
    const state = makeState(
      { groups: [{ name: "default" }] },
      { groups: [], plugins: [{ name: "a.esp", group: "Fixes & Resources" }] },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual(["Fixes & Resources"]);
    expect(result.actions).toEqual([setGroup("a.esp", undefined)]);
  });

  test("removes a group 'after' rule that references a missing group", () => {
    const state = makeState(
      { groups: [] },
      {
        groups: [{ name: "Custom Group", after: ["Fixes & Resources"] }],
        plugins: [],
      },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual(["Fixes & Resources"]);
    expect(result.actions).toEqual([removeGroupRule("Custom Group", "Fixes & Resources")]);
  });

  test("keeps a group 'after' rule that references an existing group", () => {
    const state = makeState(
      { groups: [{ name: "Early" }] },
      {
        groups: [{ name: "Custom Group", after: ["Early"] }],
        plugins: [],
      },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  test("deduplicates the missing group name when several plugins reference it", () => {
    const state = makeState(
      { groups: [] },
      {
        groups: [],
        plugins: [
          { name: "a.esp", group: "Fixes & Resources" },
          { name: "b.esp", group: "Fixes & Resources" },
        ],
      },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual(["Fixes & Resources"]);
    expect(result.actions).toEqual([setGroup("a.esp", undefined), setGroup("b.esp", undefined)]);
  });

  test("collects fixes from both plugin assignments and group rules", () => {
    const state = makeState(
      { groups: [{ name: "default" }] },
      {
        groups: [{ name: "Custom Group", after: ["Gone", "default"] }],
        plugins: [
          { name: "a.esp", group: "Missing One" },
          { name: "b.esp", group: "default" },
        ],
      },
    );

    const result = missingGroupFixes(state);

    expect(result.missing).toEqual(expect.arrayContaining(["Missing One", "Gone"]));
    expect(result.missing).toHaveLength(2);
    // plugin assignments are collected before group rules
    expect(result.actions).toEqual([
      setGroup("a.esp", undefined),
      removeGroupRule("Custom Group", "Gone"),
    ]);
  });

  test("tolerates missing masterlist / userlist slices", () => {
    expect(missingGroupFixes(makeState(undefined, undefined))).toEqual({
      missing: [],
      actions: [],
    });
  });
});
