import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { type AnyAction, createStore } from "redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ newTable: false }));

vi.mock("@/views/components/dev_tools/useDevSetting.hook", () => ({
  useDevSetting: () => mocks.newTable,
}));

import { tableReducer } from "@/reducers/tables";

import type { IModWithState } from "../../types/IModProps";
import { ModsTableSwitch } from "./ModsTableSwitch";

const mod = (id: string, name: string, enabled: boolean, extra: object = {}) =>
  ({ id, enabled, attributes: { name }, ...extra }) as unknown as IModWithState;

const collection = (id: string, name: string, memberIds: string[]) =>
  mod(id, name, true, {
    type: "collection",
    rules: memberIds.map((memberId) => ({ type: "requires", reference: { id: memberId } })),
  });

type ITablesState = { settings: { tables: typeof tableReducer.defaults } };

// The table's column choices live in settings.tables.
const makeStore = () =>
  createStore((state: ITablesState = { settings: { tables: {} } }, action: AnyAction) => {
    const reduce = tableReducer.reducers[action.type];
    return reduce ? { settings: { tables: reduce(state.settings.tables, action.payload) } } : state;
  });

const renderSwitch = (mods: { [id: string]: IModWithState }) => {
  const onSetModsEnabled = vi.fn();
  render(
    <Provider store={makeStore()}>
      <ModsTableSwitch
        legacy={<div data-testid="legacy-table" />}
        mods={mods}
        onSetModsEnabled={onSetModsEnabled}
      />
    </Provider>,
  );
  return onSetModsEnabled;
};

const showView = (name: string) => userEvent.click(screen.getByRole("button", { name }));

// The table's own rows, not those in its sticky head.
const bodyRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .filter((row) => row.closest('[role="rowgroup"]') === null);

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

    const [first, second] = bodyRows(screen.getByRole("grid"));
    expect(cellText(first)).toContain("Alpha");
    expect(cellText(second)).toContain("Beta");
    expect(within(first).getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("offers the preset views, showing all the mods to begin with", () => {
    renderSwitch({ a: mod("a", "Alpha", true) });

    const views = within(screen.getByRole("group", { name: "Views" })).getAllByRole("button");
    expect(views.map((view) => view.textContent)).toEqual(["All mods", "Collections", "Author"]);
    expect(views.map((view) => view.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("groups the mods from no collection first, then each collection's", async () => {
    renderSwitch({
      a: mod("a", "Alpha", true),
      b: mod("b", "Beta", false),
      c: mod("c", "Gamma", true),
      x: collection("x", "Xenon", ["b", "c"]),
    });

    await showView("Collections");

    const rows = bodyRows(screen.getByRole("treegrid"));
    expect(rows.map(cellText)).toEqual(["No collection1", "Alpha", "Xenon2", "Beta", "Gamma"]);
  });

  it("shows a collection's switch as part on while only some of its mods are", async () => {
    renderSwitch({
      b: mod("b", "Beta", false),
      c: mod("c", "Gamma", true),
      x: collection("x", "Xenon", ["b", "c"]),
    });

    await showView("Collections");

    const group = screen
      .getByRole("button", { name: "Xenon" })
      .closest('[role="row"]') as HTMLElement;
    expect(within(group).getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });

  it("groups the mods with no author first, then each author's, by name", async () => {
    renderSwitch({
      a: mod("a", "Alpha", true, { attributes: { name: "Alpha", author: "Zed" } }),
      b: mod("b", "Beta", true, { attributes: { name: "Beta", author: "Ann" } }),
      c: mod("c", "Gamma", true, { attributes: { name: "Gamma", author: "Zed" } }),
      d: mod("d", "Delta", true),
    });

    await showView("Author");

    const rows = bodyRows(screen.getByRole("treegrid"));
    expect(rows.map(cellText)).toEqual([
      "No author1",
      "Delta",
      "Ann1",
      "Beta",
      "Zed2",
      "Alpha",
      "Gamma",
    ]);
  });

  it("shows an author's avatar on their group, only from a mod they uploaded", async () => {
    const byAuthor = (name: string, author: string, uploader: string, uploaderAvatar: string) => ({
      attributes: { name, author, uploader, uploaderAvatar },
    });

    renderSwitch({
      a: mod("a", "Alpha", true, byAuthor("Alpha", "Ann", "Ann", "ann.png")),
      b: mod("b", "Beta", true, byAuthor("Beta", "Bo", "Someone", "someone.png")),
    });

    await showView("Author");

    const groupRow = (name: string) =>
      screen.getByRole("button", { name }).closest('[role="row"]') as HTMLElement;
    expect(groupRow("Ann").querySelector("img")).toHaveAttribute("src", "ann.png");
    // Not knowing whose face, a person icon stands in.
    expect(groupRow("Bo").querySelector("img")).toBeNull();
    expect(groupRow("Bo").querySelector(".nxm-image-avatar svg")).toBeInTheDocument();
  });

  it("builds an author's avatar from their member id when the mod doesn't carry one", async () => {
    renderSwitch({
      a: mod("a", "Alpha", true, {
        attributes: { name: "Alpha", author: "Ann", uploader: "Ann", uploaderId: 42 },
      }),
    });

    await showView("Author");

    const group = screen
      .getByRole("button", { name: "Ann" })
      .closest('[role="row"]') as HTMLElement;
    expect(group.querySelector("img")).toHaveAttribute(
      "src",
      "https://avatars.nexusmods.com/42/100",
    );
  });

  describe("enabling and disabling", () => {
    // Beta and Gamma are in Xenon; Gamma is in Yttrium too.
    const sharedMods = () => ({
      a: mod("a", "Alpha", true),
      b: mod("b", "Beta", true),
      c: mod("c", "Gamma", true),
      x: collection("x", "Xenon", ["b", "c"]),
      y: collection("y", "Yttrium", ["c"]),
    });

    const groupSwitch = (name: string) =>
      within(screen.getByRole("button", { name }).closest('[role="row"]') as HTMLElement).getByRole(
        "checkbox",
      );

    it("sets one mod from its own switch", async () => {
      const onSetModsEnabled = renderSwitch({ a: mod("a", "Alpha", true) });

      const [row] = bodyRows(screen.getByRole("grid"));
      await userEvent.click(within(row).getByRole("checkbox"));

      expect(onSetModsEnabled).toHaveBeenCalledWith(["a"], false);
    });

    it("disables a group with no shared mods without asking", async () => {
      const onSetModsEnabled = renderSwitch(sharedMods());
      await showView("Collections");

      await userEvent.click(groupSwitch("No collection"));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onSetModsEnabled).toHaveBeenCalledWith(["a"], false);
    });

    it("asks before disabling mods another collection shares", async () => {
      renderSwitch(sharedMods());
      await showView("Collections");

      await userEvent.click(groupSwitch("Xenon"));

      // The test t() doesn't interpolate, so this reads the source string; the names are
      // sharedMods's to work out, and tested there.
      expect(
        within(screen.getByRole("dialog")).getByText("1 mod is shared with: {{collections}}"),
      ).toBeInTheDocument();
    });

    it("keeps the shared mods on, if asked to", async () => {
      const onSetModsEnabled = renderSwitch(sharedMods());
      await showView("Collections");
      await userEvent.click(groupSwitch("Xenon"));

      await userEvent.click(screen.getByRole("button", { name: "Keep shared mods enabled" }));

      expect(onSetModsEnabled).toHaveBeenCalledWith(["b"], false);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("disables them all, shared ones too, if asked to", async () => {
      const onSetModsEnabled = renderSwitch(sharedMods());
      await showView("Collections");
      await userEvent.click(groupSwitch("Xenon"));

      await userEvent.click(screen.getByRole("button", { name: "Disable all mods" }));

      expect(onSetModsEnabled).toHaveBeenCalledWith(["b", "c"], false);
    });

    it("changes nothing on cancel", async () => {
      const onSetModsEnabled = renderSwitch(sharedMods());
      await showView("Collections");
      await userEvent.click(groupSwitch("Xenon"));

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onSetModsEnabled).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("enables a part-on group's mods all at once, without asking", async () => {
      const onSetModsEnabled = renderSwitch({
        b: mod("b", "Beta", false),
        c: mod("c", "Gamma", true),
        x: collection("x", "Xenon", ["b", "c"]),
        y: collection("y", "Yttrium", ["c"]),
      });
      await showView("Collections");

      await userEvent.click(groupSwitch("Xenon"));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(onSetModsEnabled).toHaveBeenCalledWith(["b", "c"], true);
    });
  });
});
