import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emit: vi.fn<(channel: string, event?: { eventName: string; properties: object }) => void>(),
  installMods: vi.fn(),
}));

// The table's analytics send through the api's events; the tests read them off this spy.
vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit: mocks.emit } } }),
}));

vi.mock("../../hooks/use_install_mods/useInstallMods.hook", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useInstallMods: () => mocks.installMods,
}));

import type { ITableRowAction } from "@/controls/Table";
import { makeModsTableStore } from "@/test-utils/modsTableStore";

import { focusModsTableGroup } from "../../actions/session";
import type { IModWithState } from "../../types/IModProps";
import { MODS_TABLE_FEEDBACK_URL } from "../mods_table_toolbar/ModsTableToolbar";
import { ModsTableSwitch } from "./ModsTableSwitch";

const mod = (id: string, name: string, enabled: boolean, extra: object = {}) =>
  ({ id, enabled, attributes: { name }, ...extra }) as unknown as IModWithState;

const collection = (id: string, name: string, memberIds: string[]) =>
  mod(id, name, true, {
    type: "collection",
    rules: memberIds.map((memberId) => ({ type: "requires", reference: { id: memberId } })),
  });

const renderSwitch = (
  mods: { [id: string]: IModWithState },
  rowActions?: ITableRowAction[],
  store: Parameters<typeof makeModsTableStore>[0] = {},
) => {
  const onSetModsEnabled = vi.fn();
  render(
    <Provider store={makeModsTableStore(store)}>
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

// The views, by whether each is open; the Add view button beside them isn't one.
const viewButtons = () =>
  within(screen.getByRole("group", { name: "Views" }))
    .getAllByRole("button")
    .filter((button) => button.hasAttribute("aria-pressed"));

const pressedViews = () => viewButtons().map((view) => view.getAttribute("aria-pressed"));

const groupBy = async (option: string) => {
  await userEvent.click(screen.getByRole("button", { name: "View options" }));
  await userEvent.click(screen.getByRole("button", { name: /Group by/ }));
  await userEvent.click(screen.getByRole("option", { name: option }));
};

// A row's actions mount once it's pointed at, as a person would before using them.
const hoverRow = (row: HTMLElement) => userEvent.hover(row);

// The table's own rows, not those in its sticky head.
const bodyRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .filter((row) => row.closest(".nxm-table-head") === null);

const cellText = (row: HTMLElement) => within(row).getAllByRole("gridcell")[0].textContent;

describe("ModsTableSwitch", () => {
  it("shows the classic table while the beta view is off", () => {
    renderSwitch({ a: mod("a", "Alpha", true) }, undefined, { betaTable: false });

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

  it("leaves a collection's own row out of the flat list", () => {
    renderSwitch({ b: mod("b", "Beta", false), x: collection("x", "Xenon", ["b"]) });

    expect(bodyRows(screen.getByRole("grid")).map(cellText)).toEqual(["Beta"]);
  });

  it("leaves a collection's own row out of a column's groups", async () => {
    renderSwitch({ b: mod("b", "Beta", false), x: collection("x", "Xenon", ["b"]) });

    await showView("Status");

    expect(bodyRows(screen.getByRole("treegrid")).map(cellText)).toEqual(["Disabled1", "Beta"]);
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

  it("offers the built-in views, showing all the mods to begin with", () => {
    renderSwitch({ a: mod("a", "Alpha", true) });

    expect(viewButtons().map((view) => view.textContent)).toEqual([
      "All mods",
      "Status",
      "Categories",
    ]);
    expect(pressedViews()).toEqual(["true", "false", "false"]);
  });

  it("offers Updates and Collections only while there's an update or a collection", () => {
    renderSwitch({
      a: mod("a", "Alpha", true, {
        state: "installed",
        attributes: { name: "Alpha", source: "nexus", version: "1.0", newestVersion: "1.1" },
      }),
      pack: collection("pack", "Starter Pack", ["a"]),
    });

    expect(viewButtons().map((view) => view.textContent)).toEqual([
      "All mods",
      "Status",
      "Updates",
      "Categories",
      "Collections",
    ]);
  });

  describe("a view of the user's own", () => {
    const createView = async (name: string) => {
      await userEvent.click(screen.getByRole("button", { name: "Add view" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Name view" }), name);
      await userEvent.click(screen.getByRole("button", { name: "Create view" }));
    };

    it("is made from Add view, after the built-in ones, and opens", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await createView("Recently installed");

      expect(viewButtons().map((view) => view.textContent)).toEqual([
        "All mods",
        "Status",
        "Categories",
        "Recently installed",
      ]);
      expect(pressedViews()).toEqual(["false", "false", "false", "true"]);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("starts each new view's name afresh, after one was cancelled", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await userEvent.click(screen.getByRole("button", { name: "Add view" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Name view" }), "Half-typed");
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await userEvent.click(screen.getByRole("button", { name: "Add view" }));

      expect(screen.getByRole("textbox", { name: "Name view" })).toHaveValue("");
    });

    it("starts ungrouped, with the version and installation time columns", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await createView("Mine");

      expect(screen.getByRole("grid")).toBeInTheDocument();
      expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
        "Name",
        "Version",
        "Installation time",
        "Actions",
      ]);
    });

    // Named for its view, which the identity translation leaves as the key.
    const openViewMenu = () =>
      userEvent.click(screen.getByRole("button", { name: "{{name}} view actions" }));

    it("opens its menu from the keyboard, handing focus back to its button on closing", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });
      await createView("Mine");
      const tab = screen.getByRole("button", { name: "Mine" });
      tab.focus();

      fireEvent.contextMenu(tab, { button: -1 });
      expect(await screen.findByRole("menuitem", { name: "Rename view" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(tab).toHaveFocus());
    });

    it("opens its menu on a right-click on its button, and a built-in view opens none", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });
      await createView("Mine");

      fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" }));
      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
        "Rename view",
        "Edit view options",
        "Delete view",
      ]);
      await userEvent.keyboard("{Escape}");

      expect(fireEvent.contextMenu(screen.getByRole("button", { name: "All mods" }))).toBe(false);
    });

    it("opens its menu from the … inside its button, without opening the view", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });
      await createView("Mine");
      await showView("All mods");

      await openViewMenu();

      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
        "Rename view",
        "Edit view options",
        "Delete view",
      ]);
      expect(pressedViews()).toEqual(["true", "false", "false", "false"]);
    });

    it("is kept if the delete isn't confirmed", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });
      await createView("Mine");

      await openViewMenu();
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete view" }));
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(viewButtons().map((view) => view.textContent)).toContain("Mine");
    });

    describe.each([
      ["its …", openViewMenu],
      [
        "a right-click on it",
        () => fireEvent.contextMenu(screen.getByRole("button", { name: "Mine" })),
      ],
    ])("from %s", (_, openMenu) => {
      it("is renamed from its menu, in the name modal", async () => {
        renderSwitch({ a: mod("a", "Alpha", true) });
        await createView("Mine");

        await openMenu();
        await userEvent.click(screen.getByRole("menuitem", { name: "Rename view" }));
        const field = screen.getByRole("textbox", { name: "Name view" });
        expect(field).toHaveValue("Mine");
        await userEvent.clear(field);
        await userEvent.type(field, "Theirs{Enter}");

        expect(viewButtons().map((view) => view.textContent)).toContain("Theirs");
      });

      it("is deleted from its menu once confirmed, back to All mods", async () => {
        renderSwitch({ a: mod("a", "Alpha", true) });
        await createView("Mine");

        await openMenu();
        await userEvent.click(screen.getByRole("menuitem", { name: "Delete view" }));
        expect(screen.getByRole("dialog", { name: "Delete view" })).toHaveTextContent(
          "Are you sure you want to delete",
        );
        await userEvent.click(screen.getByRole("button", { name: "Delete view" }));

        expect(viewButtons().map((view) => view.textContent)).toEqual([
          "All mods",
          "Status",
          "Categories",
        ]);
        expect(pressedViews()).toEqual(["true", "false", "false"]);
      });

      it("opens the view and its view options from its menu", async () => {
        renderSwitch({ a: mod("a", "Alpha", true) });
        await createView("Mine");
        await showView("All mods");

        await openMenu();
        await userEvent.click(screen.getByRole("menuitem", { name: "Edit view options" }));

        expect(pressedViews()).toEqual(["false", "false", "false", "true"]);
        expect(await screen.findByRole("button", { name: /Group by/ })).toBeInTheDocument();
      });
    });

    it("hands focus back to its button once renamed from a right-click", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });
      await createView("Mine");
      const tab = screen.getByRole("button", { name: "Mine" });
      tab.focus();

      fireEvent.contextMenu(tab);
      await userEvent.click(screen.getByRole("menuitem", { name: "Rename view" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Name view" }), "s{Enter}");

      await waitFor(() => expect(screen.getByRole("button", { name: "Mines" })).toHaveFocus());
    });

    it("keeps what's changed about it, with no default to reset to", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await createView("Mine");
      await groupBy("Author");

      expect(screen.getByRole("treegrid")).toBeInTheDocument();
      expect(screen.queryByText("Reset to default")).toBeNull();
    });
  });

  it("opens the view the user left open", () => {
    renderSwitch({ a: mod("a", "Alpha", true) }, [], {
      views: { selected: "status", changes: {}, custom: [] },
    });

    expect(pressedViews()).toEqual(["false", "true", "false"]);
  });

  it("opens the first view while the one left open isn't offered", () => {
    renderSwitch({ a: mod("a", "Alpha", true) }, [], {
      views: { selected: "updates", changes: {}, custom: [] },
    });

    expect(pressedViews()).toEqual(["true", "false", "false"]);
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

    await groupBy("Author");

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

    await groupBy("Author");

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

    await groupBy("Author");

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

    it("installs a mod only downloaded from the button in its switch's place", async () => {
      renderSwitch({ a: mod("a", "Alpha", false, { state: "downloaded" }) });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(within(row).queryByRole("checkbox", { name: "{{name}} enabled" })).toBeNull();

      await hoverRow(row);
      await userEvent.click(within(row).getByRole("button", { name: "Install {{name}}" }));

      expect(mocks.installMods).toHaveBeenCalledWith(["a"]);
    });

    it("says what installing does, under its title", async () => {
      renderSwitch({ a: mod("a", "Alpha", false, { state: "downloaded" }) });

      const [row] = bodyRows(screen.getByRole("grid"));
      await hoverRow(row);
      const button = within(row).getByRole("button", { name: "Install {{name}}" });
      await userEvent.hover(button.parentElement!);

      const tooltip = await screen.findByRole("tooltip");
      expect(within(tooltip).getByText("Install")).toHaveClass("font-semibold");
      expect(tooltip).toHaveTextContent(
        "Installs the mod into your game, where it can be enabled or disabled.",
      );
    });

    const installButton = (row: HTMLElement) =>
      within(row).getByRole("button", { name: "Install {{name}}" });

    it("shows a mod being uninstalled with the install button, loading, for its switch", async () => {
      renderSwitch({ a: mod("a", "Alpha", true, { state: "installed" }) }, [], {
        activity: { "mods-uninstalling": ["a"] },
        mods: { a: {} },
      });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(within(row).queryByRole("checkbox", { name: "{{name}} enabled" })).toBeNull();
      expect(installButton(row)).toBeDisabled();
      // A step lighter while loading, without the border.
      expect(installButton(row)).toHaveClass("nxm-button-weak");

      await hoverRow(row);
      await userEvent.hover(installButton(row).parentElement!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Uninstalling…");
    });

    // The list catches up after a debounce, so the row outlives the mod for a moment.
    it("keeps it loading once uninstalled, until the list drops its row", () => {
      renderSwitch({ a: mod("a", "Alpha", true, { state: "installed" }) }, [], { mods: {} });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(installButton(row)).toBeDisabled();
    });

    it("keeps the switch for an installed mod nothing is happening to", () => {
      renderSwitch({ a: mod("a", "Alpha", true, { state: "installed" }) }, [], {
        mods: { a: {} },
      });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(within(row).getByRole("checkbox", { name: "{{name}} enabled" })).toBeInTheDocument();
    });

    it("shows an archive being installed with the install button, loading, from the click on", () => {
      renderSwitch({ a: mod("a", "Alpha", false, { state: "downloaded" }) }, [], {
        activity: { "mods-installing": ["a"] },
      });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(installButton(row)).toBeDisabled();
    });

    it("keeps it loading once installed, until the list swaps its row for the mod's", () => {
      renderSwitch({ a: mod("a", "Alpha", false, { state: "downloaded" }) }, [], {
        mods: { m: { id: "m", archiveId: "a" } },
      });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(installButton(row)).toBeDisabled();
    });

    it("shows a mod being installed with the install button, loading", async () => {
      renderSwitch({ a: mod("a", "Alpha", false, { state: "installing" }) });

      const [row] = bodyRows(screen.getByRole("grid"));
      expect(installButton(row)).toBeDisabled();

      await hoverRow(row);
      await userEvent.hover(installButton(row).parentElement!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Installing…");
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

      expect(onSetModsEnabled).toHaveBeenCalledWith(["x", "b"], false);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("disables them all, shared ones too, if asked to", async () => {
      const onSetModsEnabled = renderSwitch(sharedMods());
      await showView("Collections");
      await userEvent.click(groupSwitch("Xenon"));

      await userEvent.click(screen.getByRole("button", { name: "Disable all mods" }));

      expect(onSetModsEnabled).toHaveBeenCalledWith(["x", "b", "c"], false);
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
      expect(onSetModsEnabled).toHaveBeenCalledWith(["x", "b", "c"], true);
    });

    it("turns a collection off with its mods, when none are shared", async () => {
      const onSetModsEnabled = renderSwitch({
        b: mod("b", "Beta", true),
        x: collection("x", "Xenon", ["b"]),
      });
      await showView("Collections");

      await userEvent.click(groupSwitch("Xenon"));

      expect(onSetModsEnabled).toHaveBeenCalledWith(["x", "b"], false);
    });

    it("turns a collection on with its mods", async () => {
      const onSetModsEnabled = renderSwitch({
        b: mod("b", "Beta", false),
        x: collection("x", "Xenon", ["b"]),
      });
      await showView("Collections");

      await userEvent.click(groupSwitch("Xenon"));

      expect(onSetModsEnabled).toHaveBeenCalledWith(["x", "b"], true);
    });
  });

  describe("display options", () => {
    const headers = () => screen.getAllByRole("columnheader").map((header) => header.textContent);

    it("shows the version and installation time columns by default", () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      expect(headers()).toEqual(["Name", "Version", "Installation time", "Actions"]);
    });

    it("shows the collection column too in the Collections view", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), pack: collection("pack", "Pack", ["a"]) });

      await showView("Collections");

      expect(headers()).toEqual(["Name", "Version", "Collection", "Installation time", "Actions"]);
    });

    it("keeps the columns shown to the view they were shown in", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await userEvent.click(screen.getByRole("button", { name: "View options" }));
      await userEvent.click(screen.getByRole("button", { name: "Author" }));
      expect(headers()).toContain("Author");

      await showView("Status");
      expect(headers()).not.toContain("Author");

      await showView("All mods");
      expect(headers()).toContain("Author");
    });

    it("adds a column chosen from the display options", async () => {
      renderSwitch({
        a: mod("a", "Alpha", true, { attributes: { name: "Alpha", author: "Ada" } }),
      });

      await userEvent.click(screen.getByRole("button", { name: "View options" }));
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

      it("offers none, then each column that can group, in the table's order", async () => {
        renderSwitch(CATEGORISED);

        await userEvent.click(screen.getByRole("button", { name: "View options" }));
        await userEvent.click(screen.getByRole("button", { name: /Group by/ }));

        expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
          "None",
          "Version",
          "Author",
          "Archive name",
          "Category",
          "Mod type",
          "Source",
          "Collection",
          "Status",
        ]);
      });

      it("groups the open view by a column's values, which stays open", async () => {
        renderSwitch(CATEGORISED);

        await groupBy("Category");

        const rows = bodyRows(screen.getByRole("treegrid"));
        expect(rows.map(cellText)).toEqual(["No {{column}}2", "Alpha", "Beta"]);
        expect(pressedViews()).toEqual(["true", "false", "false"]);
      });

      it("groups the Status view uninstalled, installing, enabled, then disabled", async () => {
        renderSwitch({
          ...CATEGORISED,
          i: mod("i", "Iota", false, { state: "installing" }),
          u: mod("u", "Upsilon", false, {
            state: "downloaded",
            attributes: { name: "Upsilon", wasInstalled: true },
          }),
        });

        await showView("Status");

        const rows = bodyRows(screen.getByRole("treegrid"));
        expect(rows.map(cellText)).toEqual([
          "Uninstalled1",
          "Upsilon",
          "Installing1",
          "Iota",
          "Enabled1",
          "Alpha",
          "Disabled1",
          "Beta",
        ]);
      });

      it("groups by version, updates first, as the classic table named them", async () => {
        renderSwitch({
          a: mod("a", "Alpha", true, {
            attributes: { name: "Alpha", source: "nexus", version: "1.0", newestVersion: "1.1" },
          }),
          b: mod("b", "Beta", true),
        });

        await groupBy("Version");

        const rows = bodyRows(screen.getByRole("treegrid"));
        expect(rows.map(cellText)).toEqual(["Update available1", "Alpha", "Up-to-date1", "Beta"]);
      });

      it("keeps a view's grouping to it, and back on returning to it", async () => {
        renderSwitch(CATEGORISED);

        await groupBy("Author");
        await showView("Status");
        expect(screen.queryByRole("button", { name: "Ada" })).toBeNull();

        await showView("All mods");
        expect(screen.getByRole("button", { name: "Ada" })).toBeInTheDocument();
      });

      it("keeps a built-in view that groups to its grouping, leaving All mods free", async () => {
        renderSwitch(CATEGORISED);
        const picker = () => screen.getByRole("button", { name: /Group by/ });

        await showView("Status");
        await userEvent.click(screen.getByRole("button", { name: "View options" }));
        expect(picker()).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: "View options" }));

        await showView("All mods");
        await userEvent.click(screen.getByRole("button", { name: "View options" }));
        expect(picker()).toBeEnabled();
      });

      it("shows what a view groups by", async () => {
        renderSwitch(CATEGORISED);

        await showView("Categories");
        await userEvent.click(screen.getByRole("button", { name: "View options" }));

        expect(screen.getByRole("button", { name: /Group by/ })).toHaveTextContent("Category");
      });

      it("resets a built-in view to its defaults, offering to only once it's changed", async () => {
        renderSwitch(CATEGORISED);

        await userEvent.click(screen.getByRole("button", { name: "View options" }));
        expect(screen.queryByText("Reset to default")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "View options" }));

        await groupBy("Author");
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

    // Selects the first mod, unless it's the one selected already, as a click would deselect it.
    const selectWithCtrl = async (...names: string[]) => {
      const user = userEvent.setup();
      const first = screen.getByText(names[0]).closest('[role="row"]');
      if (first?.getAttribute("aria-selected") !== "true") {
        await user.click(screen.getByText(names[0]));
      }
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

    it("opens the bar's menu on a right-click on one of the selected mods", async () => {
      renderSwitch({ a: mod("a", "Alpha", true), b: mod("b", "Beta", true) }, [
        { title: "Remove", action: vi.fn() },
        { title: "Combine", action: vi.fn(), multiRowAction: true, singleRowAction: false },
      ]);
      await selectWithCtrl("Alpha", "Beta");

      fireEvent.contextMenu(screen.getByText("Alpha"));

      const menu = screen.getByRole("menu", { name: "Selected mods actions" });
      expect(screen.getByText("{{count}} items selected")).toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: /Combine/ })).toBeInTheDocument();
      expect(within(menu).queryAllByRole("button", { name: /Pin|Unpin/ })).toHaveLength(0);
      // Still both selected, the bar hidden behind the menu, which holds focus.
      expect(
        screen.getByRole("region", { name: "{{count}} selected", hidden: true }),
      ).toBeInTheDocument();
    });

    it("pins Reinstall, Uninstall, Check for updates and Remove to the bar, the rest in its menu", async () => {
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
      expect(within(toolbar).getByRole("button", { name: "Uninstall" })).toBeDisabled();
      expect(within(toolbar).getByRole("button", { name: "Reinstall" })).toBeInTheDocument();
      expect(within(toolbar).getByRole("button", { name: "Remove" })).toBeInTheDocument();
      expect(within(toolbar).queryByRole("button", { name: "Combine" })).toBeNull();

      await userEvent.click(within(toolbar).getByRole("button", { name: "More actions" }));
      // Enable is the switch's to do, and Remove related is for one mod.
      expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
        "Check for updates",
        "Reinstall",
        "Uninstall",
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

      await searchFor("starter");
      expect(screen.getByText("No mods match your search")).toBeInTheDocument();

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

  describe("feedback", () => {
    // The test setup's window.api has no shell; this gives it one to watch.
    const openUrl = vi.fn();

    beforeEach(() => {
      openUrl.mockClear();
      (window as unknown as { api: Record<string, unknown> }).api.shell = { openUrl };
    });

    it("sits before the view options and the search", () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      const toolbar = screen
        .getAllByRole("toolbar")
        .find((bar) => within(bar).queryByRole("button", { name: "View options" }))!;
      expect(
        within(toolbar)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Give feedback", "View options", "Search"]);
    });

    it("opens the feedback form in the browser", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await userEvent.click(screen.getByRole("button", { name: "Give feedback" }));

      expect(openUrl).toHaveBeenCalledTimes(1);
      expect(openUrl).toHaveBeenCalledWith(MODS_TABLE_FEEDBACK_URL);
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

  it("shows a mod's card on hovering its thumbnail", async () => {
    renderSwitch({
      a: mod("a", "Alpha", true, {
        attributes: { name: "Alpha", modName: "Alpha Page", shortDescription: "Does things." },
      }),
    });

    const thumbnail = document.querySelector(".nxm-image-mod")!.parentElement!;
    await userEvent.hover(thumbnail);

    const card = await screen.findByRole("tooltip");
    expect(card).toHaveTextContent("Alpha Page");
    expect(card).toHaveTextContent("Does things.");
  });

  describe("a collection's card", () => {
    const withSummary = () => ({
      b: mod("b", "Beta", false),
      x: mod("x", "Xenon", true, {
        type: "collection",
        attributes: { name: "Xenon", shortDescription: "A starter pack." },
        rules: [{ type: "requires", reference: { id: "b" } }],
      }),
    });

    it("shows on hovering its cover on its group's row", async () => {
      renderSwitch(withSummary());
      await showView("Collections");

      await userEvent.hover(document.querySelector(".nxm-image-collection")!.parentElement!);

      const card = await screen.findByRole("tooltip");
      expect(card.querySelector(".nxm-hover-card-collection")).not.toBeNull();
      expect(card).toHaveTextContent("A starter pack.");
    });
  });

  describe("a collection's group heading", () => {
    const withCollection = () => ({
      a: mod("a", "Alpha", true),
      b: mod("b", "Beta", false),
      x: collection("x", "Xenon", ["b"]),
    });
    const groupRowOf = (name: string) =>
      screen.getByRole("button", { name }).closest('[role="row"]') as HTMLElement;
    const menuItems = () => screen.getAllByRole("menuitem").map((item) => item.textContent);

    const rowActions = (): ITableRowAction[] => [
      { title: "Reinstall", action: vi.fn() },
      { title: "Check for Update", action: vi.fn() },
    ];
    const installed = { mods: { x: {} } };
    const collectionItems = ["View collection", "Check for updates", "Remove"];

    it("offers only the collection's actions, after folding and selecting", async () => {
      renderSwitch(withCollection(), rowActions(), installed);
      await showView("Collections");

      fireEvent.contextMenu(groupRowOf("Xenon"));

      expect(menuItems()).toEqual([
        "Collapse",
        "Collapse all",
        "Select all in group",
        ...collectionItems,
      ]);
    });

    it("removes the collection as its page does", async () => {
      const reinstall = vi.fn();
      renderSwitch(withCollection(), [{ title: "Reinstall", action: reinstall }]);
      await showView("Collections");

      fireEvent.contextMenu(groupRowOf("Xenon"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

      expect(mocks.emit).toHaveBeenCalledWith("remove-collection", "x");
      expect(reinstall).not.toHaveBeenCalled();
    });

    it("opens the collection's page from View collection", async () => {
      renderSwitch(withCollection());
      await showView("Collections");

      fireEvent.contextMenu(groupRowOf("Xenon"));
      await userEvent.click(screen.getByRole("menuitem", { name: "View collection" }));

      expect(mocks.emit).toHaveBeenCalledWith("view-collection", "x");
    });

    it("offers exactly the context menu's items from the heading's …", async () => {
      renderSwitch(withCollection(), rowActions(), installed);
      await showView("Collections");

      fireEvent.contextMenu(groupRowOf("Xenon"));
      const contextItems = menuItems();
      await userEvent.keyboard("{Escape}");

      await userEvent.click(
        within(groupRowOf("Xenon")).getByRole("button", { name: "More actions" }),
      );

      expect(menuItems()).toEqual(contextItems);
      expect(contextItems).toEqual([
        "Collapse",
        "Collapse all",
        "Select all in group",
        ...collectionItems,
      ]);
    });

    it("collapses the group from the heading's …", async () => {
      renderSwitch(withCollection(), rowActions(), installed);
      await showView("Collections");

      await userEvent.click(
        within(groupRowOf("Xenon")).getByRole("button", { name: "More actions" }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "Collapse" }));

      expect(screen.getByRole("button", { name: "Xenon" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    describe("reports to the group toolbar", () => {
      const sent = () =>
        mocks.emit.mock.calls
          .filter(
            ([channel, event]) =>
              channel === "analytics-track-mixpanel-event" &&
              event.eventName === "app_toolbar_action_clicked",
          )
          .map(([, event]) => event.properties);

      beforeEach(() => {
        mocks.emit.mockReset();
      });

      it("an action from the heading's …, as overflow", async () => {
        renderSwitch(withCollection());
        await showView("Collections");

        await userEvent.click(
          within(groupRowOf("Xenon")).getByRole("button", { name: "More actions" }),
        );
        await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

        expect(sent()).toEqual([
          expect.objectContaining({
            toolbar: "mods-table-group-collection",
            surface: "overflow",
            action: "remove-collection",
          }),
        ]);
      });

      it("an action from the heading's context menu, as menu", async () => {
        renderSwitch(withCollection());
        await showView("Collections");

        fireEvent.contextMenu(groupRowOf("Xenon"));
        await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

        expect(sent()).toEqual([
          expect.objectContaining({
            toolbar: "mods-table-group-collection",
            surface: "menu",
            action: "remove-collection",
          }),
        ]);
      });

      it("a built-in item from either, with the state it moves to", async () => {
        renderSwitch(withCollection());
        await showView("Collections");

        await userEvent.click(
          within(groupRowOf("Xenon")).getByRole("button", { name: "More actions" }),
        );
        await userEvent.click(screen.getByRole("menuitem", { name: "Collapse" }));
        fireEvent.contextMenu(groupRowOf("Xenon"));
        await userEvent.click(screen.getByRole("menuitem", { name: "Expand" }));

        expect(sent()).toEqual([
          {
            toolbar: "mods-table-group-collection",
            surface: "overflow",
            action: "collapse",
            expanded: false,
          },
          {
            toolbar: "mods-table-group-collection",
            surface: "menu",
            action: "collapse",
            expanded: true,
          },
        ]);
      });

      it("View collection, by its id", async () => {
        renderSwitch(withCollection());
        await showView("Collections");

        fireEvent.contextMenu(groupRowOf("Xenon"));
        await userEvent.click(screen.getByRole("menuitem", { name: "View collection" }));

        expect(sent()).toEqual([
          expect.objectContaining({
            toolbar: "mods-table-group-collection",
            surface: "menu",
            action: "view-collection",
          }),
        ]);
      });
    });

    it("gives the no-collection group only the built-in items, from either", async () => {
      renderSwitch(withCollection(), [{ title: "Remove", action: vi.fn() }]);
      await showView("Collections");

      fireEvent.contextMenu(groupRowOf("No collection"));
      expect(menuItems()).toEqual(["Collapse", "Collapse all", "Select all in group"]);
      await userEvent.keyboard("{Escape}");

      await userEvent.click(
        within(groupRowOf("No collection")).getByRole("button", { name: "More actions" }),
      );
      expect(menuItems()).toEqual(["Collapse", "Collapse all", "Select all in group"]);
    });

    describe("asked to show it", () => {
      beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
      });

      afterEach(() => {
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      });

      const renderAsked = () => {
        const store = makeModsTableStore({
          views: { selected: "collections", changes: {}, custom: [] },
          focusedGroupId: "x",
        });
        render(
          <Provider store={store}>
            <ModsTableSwitch legacy={<div />} mods={withCollection()} onSetModsEnabled={vi.fn()} />
          </Provider>,
        );
        return store;
      };

      it("opens its group and drops the request", async () => {
        const store = renderAsked();

        expect(screen.getByRole("button", { name: "Xenon" })).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await waitFor(() => expect(store.getState().session.mods.focusedGroupId).toBeUndefined());
      });

      it("drops a request no group answers, leaving the table as it was", async () => {
        const store = makeModsTableStore({
          views: { selected: "all", changes: {}, custom: [] },
          focusedGroupId: "x",
        });
        render(
          <Provider store={store}>
            <ModsTableSwitch legacy={<div />} mods={withCollection()} onSetModsEnabled={vi.fn()} />
          </Provider>,
        );

        await waitFor(() => expect(store.getState().session.mods.focusedGroupId).toBeUndefined());
        expect(screen.queryByRole("button", { name: "Xenon" })).toBeNull();
      });

      it("lets the user search once the request is honoured", async () => {
        renderAsked();
        await userEvent.click(screen.getByRole("button", { name: "Search" }));
        await userEvent.keyboard("Alpha");

        expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("Alpha");
      });

      it("clears a search that would hide it", async () => {
        const store = makeModsTableStore({
          views: { selected: "collections", changes: {}, custom: [] },
        });
        render(
          <Provider store={store}>
            <ModsTableSwitch legacy={<div />} mods={withCollection()} onSetModsEnabled={vi.fn()} />
          </Provider>,
        );
        await userEvent.click(screen.getByRole("button", { name: "Search" }));
        await userEvent.keyboard("Alpha");
        expect(screen.queryByRole("button", { name: "Xenon" })).toBeNull();

        act(() => {
          store.dispatch(focusModsTableGroup("x"));
        });

        expect(await screen.findByRole("button", { name: "Xenon" })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
      });
    });
  });

  describe("a row's context menu", () => {
    it("changes the row's pins from its pin toggles", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);
      const pins = () =>
        within(screen.getByRole("menu", { name: "{{name}} actions" }))
          .getAllByRole("button", { name: /the row/ })
          .map((pin) => pin.getAttribute("aria-label"));

      fireEvent.contextMenu(screen.getByText("Alpha"));
      const before = pins();
      await userEvent.click(
        within(screen.getByRole("menu", { name: "{{name}} actions" })).getAllByRole("button", {
          name: /the row/,
        })[0],
      );

      expect(pins()[0]).not.toBe(before[0]);
    });

    it("opens the row's own menu, as its … has it, its pins for the row", () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      fireEvent.contextMenu(screen.getByText("Alpha"));

      const menu = screen.getByRole("menu", { name: "{{name}} actions" });
      expect(within(menu).getByRole("menuitem", { name: /^Remove/ })).toBeInTheDocument();
      expect(within(menu).getAllByRole("button", { name: /the row/ }).length).toBeGreaterThan(0);
    });
  });

  // End to end through the real toolbars and table, so a component missing its tracking shows.
  describe("tracking", () => {
    /** The properties of each analytics event sent with this name, in order. */
    const sent = (eventName: string) =>
      mocks.emit.mock.calls
        .filter(
          ([channel, event]) =>
            channel === "analytics-track-mixpanel-event" && event.eventName === eventName,
        )
        .map(([, event]) => event.properties);

    const rowOf = (name: string) =>
      screen.getAllByRole("row").find((row) => within(row).queryByText(name) !== null)!;

    beforeEach(() => {
      mocks.emit.mockReset();
      (window as unknown as { api: Record<string, unknown> }).api.shell = { openUrl: vi.fn() };
    });

    it("reports the feedback button from the table's own toolbar", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await userEvent.click(screen.getByRole("button", { name: "Give feedback" }));

      expect(sent("app_toolbar_action_clicked")).toEqual([
        expect.objectContaining({ action: "feedback", toolbar: "mods-table", surface: "bar" }),
      ]);
    });

    it("reports a row's action from its … menu, as the row toolbar's overflow", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      await hoverRow(rowOf("Alpha"));
      await userEvent.click(within(rowOf("Alpha")).getByRole("button", { name: "More actions" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

      expect(sent("app_toolbar_action_clicked")).toEqual([
        expect.objectContaining({
          action: "Remove",
          toolbar: "mods-table-row",
          surface: "overflow",
        }),
      ]);
    });

    it("reports a row's action from its right-click menu", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      fireEvent.contextMenu(rowOf("Alpha"), { clientX: 10, clientY: 10 });
      await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));

      expect(sent("app_toolbar_action_clicked")).toEqual([
        expect.objectContaining({ action: "Remove", toolbar: "mods-table-row", surface: "menu" }),
      ]);
    });

    it("reports a right-click menu opening on a row", () => {
      renderSwitch({ a: mod("a", "Alpha", true) }, [{ title: "Remove", action: vi.fn() }]);

      fireEvent.contextMenu(rowOf("Alpha"), { clientX: 10, clientY: 10 });

      expect(sent("app_mods_table_menu_opened")).toEqual([{ target: "row", via: "pointer" }]);
    });

    it("reports picking another view, and changing its grouping", async () => {
      renderSwitch({ b: mod("b", "Beta", true), pack: collection("pack", "Starter Pack", ["b"]) });

      // Collections keeps to its own grouping, so the grouping changes in All mods first.
      await groupBy("Author");
      await showView("Collections");

      expect(sent("app_mods_table_view_selected")).toEqual([{ view: "collections" }]);
      expect(sent("app_mods_table_grouping_changed")).toHaveLength(1);
    });

    it("reports a search once as it starts, without the text", async () => {
      renderSwitch({ a: mod("a", "Alpha", true) });

      await userEvent.click(screen.getByRole("button", { name: "Search" }));
      await userEvent.keyboard("alp");

      expect(sent("app_mods_table_searched")).toEqual([{}]);
    });
  });
});
