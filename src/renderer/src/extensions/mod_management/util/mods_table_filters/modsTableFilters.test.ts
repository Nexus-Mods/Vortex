import { describe, expect, it } from "vitest";

import type { IModWithState } from "../../types/IModProps";
import { changedFilterKeys, filterModsByStatus } from "./modsTableFilters";

const mod = (id: string, overrides: Partial<IModWithState> = {}) =>
  ({ id, state: "installed", enabled: true, attributes: {}, ...overrides }) as IModWithState;

const isEnabled = (m: IModWithState) => !!m.enabled;

const MODS = {
  on: mod("on"),
  off: mod("off", { enabled: false }),
  was: mod("was", { state: "downloaded", attributes: { wasInstalled: true } }),
  never: mod("never", { state: "downloaded" }),
  busy: mod("busy", { state: "installing" }),
  pack: mod("pack", { type: "collection" }),
};

const ids = (mods: { [id: string]: IModWithState }) => Object.keys(mods).sort();

describe("filterModsByStatus", () => {
  it("keeps every mod while nothing is ticked", () => {
    expect(filterModsByStatus(MODS, [], isEnabled)).toBe(MODS);
  });

  it("keeps the ticked statuses only", () => {
    expect(ids(filterModsByStatus(MODS, ["disabled", "uninstalled"], isEnabled))).toEqual([
      "busy",
      "never",
      "off",
      "pack",
      "was",
    ]);
  });

  it("keeps installing mods under any filter", () => {
    expect(filterModsByStatus(MODS, ["enabled"], isEnabled)).toHaveProperty("busy");
  });

  it("keeps collections, whose groups head their members", () => {
    expect(filterModsByStatus(MODS, ["uninstalled"], isEnabled)).toHaveProperty("pack");
  });
});

describe("changedFilterKeys", () => {
  it("says which filters differ, ignoring order", () => {
    expect(
      changedFilterKeys({ status: ["disabled", "enabled"] }, { status: ["enabled", "disabled"] }),
    ).toEqual([]);
    expect(changedFilterKeys({ status: ["enabled"] }, { status: [] })).toEqual(["status"]);
  });
});
