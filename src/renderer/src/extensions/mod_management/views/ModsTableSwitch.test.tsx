import { render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ newTable: false }));

vi.mock("@/views/components/dev_tools/useDevSetting.hook", () => ({
  useDevSetting: () => mocks.newTable,
}));

import type { IModWithState } from "../types/IModProps";
import { ModsTableSwitch } from "./ModsTableSwitch";

const mod = (id: string, name: string, enabled: boolean, extra: object = {}) =>
  ({ id, enabled, attributes: { name }, ...extra }) as unknown as IModWithState;

const collection = (id: string, name: string, memberIds: string[]) =>
  mod(id, name, true, {
    type: "collection",
    rules: memberIds.map((memberId) => ({ type: "requires", reference: { id: memberId } })),
  });

const renderSwitch = (mods: { [id: string]: IModWithState }) =>
  render(<ModsTableSwitch legacy={<div data-testid="legacy-table" />} mods={mods} />);

const cellText = (row: HTMLElement) => within(row).getAllByRole("gridcell")[0].textContent;

describe("ModsTableSwitch", () => {
  beforeEach(() => {
    mocks.newTable = true;
  });

  it("shows the legacy table while the new table design is off", () => {
    mocks.newTable = false;
    renderSwitch({ a: mod("a", "Alpha", true) });

    expect(screen.getByTestId("legacy-table")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("lists the mods by name, ungrouped, when no collection is installed", () => {
    renderSwitch({ b: mod("b", "Beta", false), a: mod("a", "Alpha", true) });

    const [, first, second] = within(screen.getByRole("grid")).getAllByRole("row");
    expect(cellText(first)).toContain("Alpha");
    expect(cellText(second)).toContain("Beta");
    expect(within(first).getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("groups the mods from no collection first, then each collection's", () => {
    renderSwitch({
      a: mod("a", "Alpha", true),
      b: mod("b", "Beta", false),
      c: mod("c", "Gamma", true),
      x: collection("x", "Xenon", ["b", "c"]),
    });

    const rows = within(screen.getByRole("treegrid")).getAllByRole("row").slice(1);
    expect(rows.map(cellText)).toEqual(["No collection1", "Alpha", "Xenon2", "Beta", "Gamma"]);
  });

  it("shows a collection's switch as part on while only some of its mods are", () => {
    renderSwitch({
      b: mod("b", "Beta", false),
      c: mod("c", "Gamma", true),
      x: collection("x", "Xenon", ["b", "c"]),
    });

    const group = screen
      .getByRole("button", { name: "Xenon" })
      .closest('[role="row"]') as HTMLElement;
    expect(within(group).getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });
});
