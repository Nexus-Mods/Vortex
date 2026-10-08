import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ newTable: false }));

vi.mock("@/views/components/dev_tools/useDevSetting.hook", () => ({
  useDevSetting: () => mocks.newTable,
}));

import type { ITableRowAction } from "@/controls/Table";
import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModWithState } from "../../types/IModProps";
import { ModsTableSwitch } from "./ModsTableSwitch";

const mod = (id: string, name: string, enabled: boolean, extra: object = {}) =>
  ({ id, enabled, attributes: { name }, ...extra }) as unknown as IModWithState;

const collection = (id: string, name: string, memberIds: string[]) =>
  mod(id, name, true, {
    type: "collection",
    rules: memberIds.map((memberId) => ({ type: "requires", reference: { id: memberId } })),
  });

const renderSwitch = (mods: { [id: string]: IModWithState }, rowActions?: ITableRowAction[]) => {
  const onSetModsEnabled = vi.fn();
  render(
    <Provider store={makeModsTableStore()}>
      <ModsTableSwitch
        legacy={<div data-testid="legacy-table" />}
        mods={mods}
        rowActions={rowActions}
        onSetModsEnabled={onSetModsEnabled}
      />
    </Provider>,
  );
  return onSetModsEnabled;
};

const showView = (name: string) => userEvent.click(screen.getByRole("button", { name }));

// A row's actions mount once it's pointed at, as a person would before using them.
const hoverRow = (row: HTMLElement) => userEvent.hover(row);

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
    expect(within(first).getByRole("checkbox", { name: "{{name}} enabled" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  // ModList rebuilds the mods only after a debounce, so a switch would lag behind its click.
  it("shows a mod's enabled state from the profile, ahead of the mods it was given", () => {
    render(
      <Provider store={makeModsTableStore({ modState: { a: { enabled: true } } })}>
        <ModsTableSwitch
          legacy={<div />}
          mods={{ a: mod("a", "Alpha", false) }}
          onSetModsEnabled={vi.fn()}
        />
      </Provider>,
    );

    const [row] = bodyRows(screen.getByRole("grid"));
    expect(within(row).getByRole("checkbox", { name: "{{name}} enabled" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  describe("while a switch's change is under way", () => {
    // Settles the change the switch asked for: resolves, or fails, when the test says.
    const renderPending = (modState?: { [id: string]: { enabled: boolean } }) => {
      let settle: (ok: boolean) => void = () => {};
      const onSetModsEnabled = vi.fn(
        () =>
          new Promise<void>((resolve, reject) => {
            settle = (ok) => (ok ? resolve() : reject(new Error("refused")));
          }),
      );
      const store = makeModsTableStore({ modState });
      render(
        <Provider store={store}>
          <ModsTableSwitch
            legacy={<div />}
            mods={{ a: mod("a", "Alpha", false) }}
            onSetModsEnabled={onSetModsEnabled}
          />
        </Provider>,
      );
      return { settle: (ok: boolean) => act(async () => settle(ok)) };
    };

    const modSwitch = () =>
      within(bodyRows(screen.getByRole("grid"))[0]).getByRole("checkbox", {
        name: "{{name}} enabled",
      });

    const clickSwitch = async () => {
      await hoverRow(bodyRows(screen.getByRole("grid"))[0]);
      await userEvent.click(modSwitch());
    };

    it("shows the change at once, busy, and undoes it if it fails", async () => {
      const { settle } = renderPending();

      await clickSwitch();
      expect(modSwitch()).toHaveAttribute("aria-checked", "true");
      expect(modSwitch()).toHaveAttribute("aria-busy", "true");

      await settle(false);
      expect(modSwitch()).toHaveAttribute("aria-checked", "false");
      expect(modSwitch()).not.toHaveAttribute("aria-busy");
    });

    // The profile is the truth once the change is done, whatever the switch showed meanwhile.
    it("follows the profile again once the change settles", async () => {
      const { settle } = renderPending({ a: { enabled: true } });

      await clickSwitch();
      expect(modSwitch()).toHaveAttribute("aria-checked", "false");

      await settle(true);
      expect(modSwitch()).toHaveAttribute("aria-checked", "true");
      expect(modSwitch()).not.toHaveAttribute("aria-busy");
    });
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
      await hoverRow(row);
      await userEvent.click(within(row).getByRole("checkbox", { name: "{{name}} enabled" }));

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

  describe("display options", () => {
    const headers = () => screen.getAllByRole("columnheader").map((header) => header.textContent);

    it("shows the version, collection and installation time columns by default", () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      expect(headers()).toEqual(["Name", "Version", "Collection", "Installation time", "Actions"]);
    });

    it("adds a column chosen from the display options", async () => {
      renderSwitch({
        a: mod("a", "Alpha", true, { attributes: { name: "Alpha", author: "Ada" } }),
      });

      await userEvent.click(screen.getByRole("button", { name: "Display options" }));
      const toggles = screen.getByRole("group", { name: "Toggle columns" });
      await userEvent.click(within(toggles).getByRole("button", { name: "Author" }));

      expect(headers()).toContain("Author");
      expect(screen.getByRole("gridcell", { name: "Ada" })).toBeInTheDocument();
    });

    describe("group by", () => {
      const CATEGORISED = {
        a: mod("a", "Alpha", true, { attributes: { name: "Alpha", author: "Ada" } }),
        b: mod("b", "Beta", false),
      };

      const groupBy = async (option: string) => {
        await userEvent.click(screen.getByRole("button", { name: "Display options" }));
        await userEvent.click(screen.getByRole("button", { name: /Group by/ }));
        await userEvent.click(screen.getByRole("option", { name: option }));
      };

      const pressedViews = () =>
        within(screen.getByRole("group", { name: "Views" }))
          .getAllByRole("button")
          .map((view) => view.getAttribute("aria-pressed"));

      it("offers none, then each column that can group, in the table's order", async () => {
        renderSwitch(CATEGORISED);

        await userEvent.click(screen.getByRole("button", { name: "Display options" }));
        await userEvent.click(screen.getByRole("button", { name: /Group by/ }));

        expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
          "None",
          "Author",
          "Archive name",
          "Category",
          "Mod type",
          "Source",
          "Collection",
          "Status",
        ]);
      });

      it("groups by a column's values, no view selected", async () => {
        renderSwitch(CATEGORISED);

        await groupBy("Status");

        const rows = bodyRows(screen.getByRole("treegrid"));
        expect(rows.map(cellText)).toEqual(["Disabled1", "Beta", "Enabled1", "Alpha"]);
        expect(pressedViews()).toEqual(["false", "false", "false"]);
      });

      it("selects the view a grouping matches", async () => {
        renderSwitch(CATEGORISED);

        await groupBy("Author");

        expect(pressedViews()).toEqual(["false", "false", "true"]);
      });

      it("shows what a view groups by", async () => {
        renderSwitch(CATEGORISED);

        await showView("Collections");
        await userEvent.click(screen.getByRole("button", { name: "Display options" }));

        expect(screen.getByRole("button", { name: /Group by/ })).toHaveTextContent("Collection");
      });

      it("ungroups on reset", async () => {
        renderSwitch(CATEGORISED);

        await groupBy("Status");
        await userEvent.click(screen.getByText("Reset to default"));

        expect(screen.getByRole("grid")).toBeInTheDocument();
        expect(pressedViews()).toEqual(["true", "false", "false"]);
      });
    });
  });
  describe("row actions", () => {
    const rowOf = (name: string) =>
      screen.getAllByRole("row").find((row) => within(row).queryByText(name) !== null)!;

    const openMenu = async (name: string) => {
      await hoverRow(rowOf(name));
      await userEvent.click(within(rowOf(name)).getByRole("button", { name: "More actions" }));
    };

    it("mounts a row's actions only once it's pointed at", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      expect(within(rowOf("Alpha")).queryByRole("button", { name: "More actions" })).toBeNull();
      expect(
        within(rowOf("Alpha")).getByRole("checkbox", { name: "{{name}} enabled" }),
      ).toBeInTheDocument();

      await hoverRow(rowOf("Alpha"));

      expect(
        within(rowOf("Alpha")).getByRole("button", { name: "More actions" }),
      ).toBeInTheDocument();
    });

    it("keeps focus on the switch as focusing it mounts the row's actions", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      act(() => {
        within(rowOf("Alpha")).getByRole("checkbox", { name: "{{name}} enabled" }).focus();
      });

      expect(
        within(rowOf("Alpha")).getByRole("button", { name: "More actions" }),
      ).toBeInTheDocument();
      expect(document.activeElement).toBe(
        within(rowOf("Alpha")).getByRole("checkbox", { name: "{{name}} enabled" }),
      );
    });

    it("opens a row's menu of its actions, run against that mod", async () => {
      const remove = vi.fn();
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) }, [
        { title: "Remove", action: remove },
      ]);

      await openMenu("Beta");
      await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

      expect(remove).toHaveBeenCalledWith(["b"]);
    });

    it("puts an action pinned from one row's menu on every row", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) }, [
        { title: "Remove", action: vi.fn() },
      ]);

      await openMenu("Alpha");
      // reached through its menu row, as the test `t` leaves every pin's label alike
      await userEvent.click(
        within(screen.getByRole("menuitem", { name: /Remove/ })).getByRole("button"),
      );
      await userEvent.keyboard("{Escape}");

      expect(within(rowOf("Alpha")).getByRole("button", { name: "Remove" })).toBeInTheDocument();

      await hoverRow(rowOf("Beta"));
      expect(within(rowOf("Beta")).getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });

    it("shows a pinned action before the switch, and the menu after it", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      await openMenu("Alpha");
      await userEvent.click(
        within(screen.getByRole("menuitem", { name: /Remove/ })).getByRole("button"),
      );
      await userEvent.keyboard("{Escape}");

      const actionsCell = within(rowOf("Alpha")).getAllByRole("gridcell").at(-1) as HTMLElement;
      const controls = Array.from(
        actionsCell.querySelectorAll<HTMLElement>('button, [role="checkbox"]'),
      ).map((control) => control.getAttribute("aria-label"));
      // the switch by its untranslated label, which `t` leaves uninterpolated here
      expect(controls).toEqual(["Remove", "{{name}} enabled", "More actions"]);
    });
  });

  describe("selected mods", () => {
    const bar = () => screen.queryByRole("region", { name: "{{count}} selected" });

    const selectWithCtrl = async (...names: string[]) => {
      const user = userEvent.setup();
      await user.click(screen.getByText(names[0]));
      await user.keyboard("{Control>}");
      for (const name of names.slice(1)) {
        await user.click(screen.getByText(name));
      }
      await user.keyboard("{/Control}");
    };

    const barSwitch = () => within(bar()!).getByRole("checkbox", { name: "Selected mods enabled" });

    it("shows the bar while several mods are selected, and hides it once they're deselected", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) });

      await userEvent.click(screen.getByText("Alpha"));
      expect(bar()).toBeNull();

      await selectWithCtrl("Alpha", "Beta");
      expect(bar()).toBeInTheDocument();

      await userEvent.click(within(bar()!).getByRole("button", { name: "Deselect all" }));
      expect(bar()).toBeNull();
      expect(bodyRows(screen.getByRole("grid"))[0]).toHaveAttribute("aria-selected", "false");
    });

    it("pins Check for updates, Reinstall and Remove to the bar, the rest in its menu", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) }, [
        { title: "Enable", singleRowAction: false },
        { title: "Remove", action: vi.fn() },
        { title: "Reinstall", action: vi.fn() },
        { title: "Combine", action: vi.fn(), multiRowAction: true, singleRowAction: false },
        { title: "Remove related", action: vi.fn(), multiRowAction: false },
      ]);

      await selectWithCtrl("Alpha", "Beta");
      const toolbar = within(bar()!).getByRole("toolbar");

      // Kept, disabled, for mods that aren't installed, so its button keeps its place.
      expect(within(toolbar).getByRole("button", { name: "Check for updates" })).toBeDisabled();
      expect(within(toolbar).getByRole("button", { name: "Reinstall" })).toBeInTheDocument();
      expect(within(toolbar).getByRole("button", { name: "Remove" })).toBeInTheDocument();
      expect(within(toolbar).queryByRole("button", { name: "Combine" })).toBeNull();

      await userEvent.click(within(toolbar).getByRole("button", { name: "More actions" }));
      // Enable is the switch's to do, and Remove related is for one mod.
      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
        "Reinstall",
        "Check for updates",
        "Remove",
        "Combine",
      ]);
    });

    it("runs a bar action against every selected mod", async () => {
      const remove = vi.fn();
      renderSwitch(
        { a: mod("a", "Alpha", true), b: mod("b", "Beta", true), c: mod("c", "Gamma", true) },
        [{ title: "Remove", action: remove }],
      );

      await selectWithCtrl("Alpha", "Gamma");
      await userEvent.click(within(bar()!).getByRole("button", { name: "Remove" }));

      expect(remove).toHaveBeenCalledWith(["a", "c"]);
    });

    it("shows the bar's switch part on for a mix, and disables them all from it", async () => {
      const onSetModsEnabled = renderSwitch({
        a: mod("a", "Alpha", true),
        b: mod("b", "Beta", false),
      });

      await selectWithCtrl("Alpha", "Beta");
      expect(barSwitch()).toHaveAttribute("aria-checked", "mixed");

      await userEvent.click(barSwitch());
      expect(onSetModsEnabled).toHaveBeenCalledWith(["a", "b"], true);
    });

    it("shows only the rows' switches while several mods are selected", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) }, [
        { title: "Remove", action: vi.fn() },
      ]);
      const rowOf = (name: string) =>
        bodyRows(screen.getByRole("grid")).find((row) => within(row).queryByText(name))!;

      await hoverRow(rowOf("Alpha"));
      await userEvent.click(within(rowOf("Alpha")).getByRole("button", { name: "More actions" }));
      await userEvent.click(
        within(screen.getByRole("menuitem", { name: /Remove/ })).getByRole("button"),
      );
      await userEvent.keyboard("{Escape}");

      await userEvent.click(screen.getByText("Alpha"));
      expect(within(rowOf("Alpha")).getByRole("button", { name: "Remove" })).toBeInTheDocument();

      await selectWithCtrl("Alpha", "Beta");
      expect(within(rowOf("Alpha")).queryByRole("button", { name: "Remove" })).toBeNull();
      expect(within(rowOf("Alpha")).queryByRole("button", { name: "More actions" })).toBeNull();
      expect(
        within(rowOf("Alpha")).getByRole("checkbox", { name: "{{name}} enabled" }),
      ).toBeInTheDocument();
    });
  });

  describe("search", () => {
    const searchFor = async (text: string) => {
      await userEvent.click(screen.getByRole("button", { name: "Search" }));
      await userEvent.keyboard(text);
    };

    const names = () => bodyRows(screen.getByRole("grid")).map(cellText);

    it("lists only the mods whose cells show the text, whatever its case", async () => {
      renderSwitch({
        a: mod("a", "Alpha", true),
        b: mod("b", "Beta", true),
        c: mod("c", "Alphabet", true),
      });

      await searchFor("ALPHA");

      expect(names()).toEqual(["Alpha", "Alphabet"]);
    });

    it("searches the columns shown, not the hidden ones", async () => {
      renderSwitch({
        a: mod("a", "Alpha", true, { attributes: { name: "Alpha", author: "Gervig" } }),
        b: mod("b", "Beta", true),
        pack: collection("pack", "Starter Pack", ["b"]),
      });

      // Collection shows by default, and the collection's own row its name; Author doesn't show.
      await searchFor("starter");
      expect(names()).toEqual(["Beta", "Starter Pack"]);

      await userEvent.clear(screen.getByRole("textbox", { name: "Search" }));
      await userEvent.keyboard("gervig");
      expect(screen.getByText("No mods match your search")).toBeInTheDocument();
    });

    it("drops a group none of whose mods match", async () => {
      renderSwitch({
        a: mod("a", "Alpha", true),
        b: mod("b", "Beta", true),
        pack: collection("pack", "Starter Pack", ["b"]),
      });

      await showView("Collections");
      await searchFor("alpha");

      const treegrid = screen.getByRole("treegrid");
      expect(within(treegrid).queryByRole("button", { name: "Starter Pack" })).toBeNull();
      expect(
        bodyRows(treegrid)
          .filter((row) => row.getAttribute("aria-level") === "2")
          .map(cellText),
      ).toEqual(["Alpha"]);
    });

    it("deselects a selected mod the search hides", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) });

      const user = userEvent.setup();
      await user.click(screen.getByText("Alpha"));
      await user.keyboard("{Control>}");
      await user.click(screen.getByText("Beta"));
      await user.keyboard("{/Control}");
      expect(screen.getByRole("region", { name: "{{count}} selected" })).toBeInTheDocument();

      await searchFor("alpha");
      await userEvent.clear(screen.getByRole("textbox", { name: "Search" }));

      expect(screen.queryByRole("region", { name: "{{count}} selected" })).toBeNull();
      const selected = bodyRows(screen.getByRole("grid")).filter(
        (row) => row.getAttribute("aria-selected") === "true",
      );
      expect(selected.map(cellText)).toEqual(["Alpha"]);
    });
  });

  describe("version", () => {
    it("switches a mod to another of its versions from its row", async () => {
      const onSelectVersion = vi.fn();
      const current = mod("a", "Alpha", true, { attributes: { name: "Alpha", version: "2.0" } });
      const older = mod("a1", "Alpha", false, { attributes: { name: "Alpha", version: "1.0" } });
      render(
        <Provider store={makeModsTableStore()}>
          <ModsTableSwitch
            alternatives={{ a: [current, older] }}
            legacy={<div />}
            mods={{ a: current }}
            onSelectVersion={onSelectVersion}
            onSetModsEnabled={vi.fn()}
          />
        </Provider>,
      );

      await userEvent.click(screen.getByRole("button", { name: "2.0 (default)" }));
      await userEvent.click(screen.getByRole("menuitemradio", { name: /^1\.0 \(default\)/ }));

      expect(onSelectVersion).toHaveBeenCalledWith("a", "a1");
    });

    it("removes one of a mod's versions from its row, as ModList does", async () => {
      const onRemoveVersion = vi.fn();
      const current = mod("a", "Alpha", true, { attributes: { name: "Alpha", version: "2.0" } });
      const older = mod("a1", "Alpha", false, { attributes: { name: "Alpha", version: "1.0" } });
      render(
        <Provider store={makeModsTableStore()}>
          <ModsTableSwitch
            alternatives={{ a: [current, older] }}
            legacy={<div />}
            mods={{ a: current }}
            onRemoveVersion={onRemoveVersion}
            onSetModsEnabled={vi.fn()}
          />
        </Provider>,
      );

      await userEvent.click(screen.getByRole("button", { name: "2.0 (default)" }));
      await userEvent.click(
        within(screen.getByRole("menuitemradio", { name: /^1\.0 \(default\)/ })).getByRole(
          "button",
          { name: "Remove version" },
        ),
      );

      expect(onRemoveVersion).toHaveBeenCalledWith("a1");
    });
  });
});
