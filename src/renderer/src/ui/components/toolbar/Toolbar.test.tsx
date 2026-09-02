import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Provider } from "react-redux";
import { afterEach, describe, it, expect, vi } from "vitest";

import { toolbarReducer } from "@/reducers/toolbars";
import type { IToolbarStates } from "@/types/IState";

import { Toolbar } from "./Toolbar";
import type { IToolbarAnalytics } from "./Toolbar.context";
import { ToolbarGroup, type IToolbarAction } from "./ToolbarGroup";
import { fitVisibleActions, type IToolbarGroupMetrics } from "./useToolbarOverflow.hook";

// --- Helpers ---

/**
 * Where a pinning toolbar keeps what the user decided. Minimal rather than the app's
 * own tree — react-redux asks for these three — but reducing through the real
 * reducer, so a decision has to survive the round trip to reach the bar.
 */
const makeStore = (toolbars: IToolbarStates) => {
  let state = { settings: { toolbars } };
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action: { type: string; payload: never }) => {
      const reduce = toolbarReducer.reducers[action.type];

      if (reduce) {
        state = { settings: { toolbars: reduce(state.settings.toolbars, action.payload) } };
        listeners.forEach((listener) => listener());
      }

      return action;
    },
  };
};

const makeActions = (count: number): IToolbarAction[] =>
  Array.from({ length: count }, (_, i) => ({ label: `Action ${i + 1}`, iconPath: "mdi-test" }));

/**
 * The kebab is found by test id, not by its name: that name is translated, and
 * nothing may key off a string that changes with the language.
 */
const KEBAB_TEST_ID = "toolbar-overflow";

const getKebab = () => screen.getByTestId(KEBAB_TEST_ID);

/** Tracking whose every callback is a spy, for a test that cares about only one. */
const silentTracking = (): IToolbarAnalytics => ({
  onActionClick: vi.fn(),
  onPinChange: vi.fn(),
  onPinsReset: vi.fn(),
});

const queryKebab = () => screen.queryByTestId(KEBAB_TEST_ID);

const actionButtons = () =>
  screen.getAllByRole("button").filter((button) => button.dataset.testid !== KEBAB_TEST_ID);

const countActionButtons = () => actionButtons().length;

/**
 * happy-dom lays nothing out, so every control reports a width of 0. These stubs
 * stand in for a real layout: a uniform width per control and a row width the
 * test drives.
 */
const CONTROL_WIDTH = 28;

let rowWidth = 0;
const resizeCallbacks: Array<() => void> = [];

// Captured before anything is stubbed so each test can hand the environment's
// own definitions back, wherever on the prototype chain they came from.
const nativeWidths = (["offsetWidth", "clientWidth"] as const).map((property) => ({
  property,
  descriptor: Object.getOwnPropertyDescriptor(HTMLElement.prototype, property),
}));

const restoreWidths = () => {
  nativeWidths.forEach(({ descriptor, property }) => {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, property, descriptor);
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>)[property];
    }
  });
};

const stubLayout = (initialRowWidth: number) => {
  rowWidth = initialRowWidth;

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      // A popover wrapper is the group's child for both the kebab and any action
      // that opens a panel; the button it holds is a level down.
      const isControl = this.tagName === "BUTTON" || this.classList.contains("nxm-popover");
      return isControl ? CONTROL_WIDTH : 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("nxm-toolbar") ? rowWidth : 0;
    },
  });

  vi.stubGlobal(
    "ResizeObserver",
    class {
      public observe = vi.fn();
      public disconnect = vi.fn();

      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
    },
  );
};

const resizeRowTo = (width: number) => {
  rowWidth = width;
  act(() => resizeCallbacks.forEach((callback) => callback()));
};

afterEach(() => {
  resizeCallbacks.length = 0;
  vi.unstubAllGlobals();
  restoreWidths();
});

// --- Tests ---

describe("Toolbar", () => {
  it('renders a container with role="toolbar"', () => {
    render(<Toolbar>content</Toolbar>);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(
      <Toolbar>
        <span data-testid="child" />
      </Toolbar>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("merges custom className with the base class", () => {
    render(<Toolbar className="my-class">content</Toolbar>);
    expect(screen.getByRole("toolbar")).toHaveClass("nxm-toolbar", "my-class");
  });

  it("passes through arbitrary HTML attributes", () => {
    render(<Toolbar data-testid="bar">content</Toolbar>);
    expect(screen.getByTestId("bar")).toBeInTheDocument();
  });
});

describe("ToolbarGroup", () => {
  describe("rendering", () => {
    it("renders one button per action when under the limit", () => {
      render(<ToolbarGroup actions={makeActions(3)} />);
      expect(screen.getAllByRole("button")).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Action 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action 3" })).toBeInTheDocument();
    });

    it("renders an icon-only button (label as aria-label, not visible text)", () => {
      render(<ToolbarGroup actions={[{ label: "Refresh", iconPath: "mdi-test" }]} />);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
      expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    });

    it("renders visible label text when showLabel is set", () => {
      render(<ToolbarGroup actions={[{ label: "1 selected", showLabel: true }]} />);
      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("defaults actions to the neutral brand", () => {
      render(<ToolbarGroup actions={[{ label: "Plain", iconPath: "mdi-test" }]} />);
      expect(screen.getByRole("button", { name: "Plain" })).toHaveClass("nxm-button-neutral");
    });

    it("applies a custom brand", () => {
      render(<ToolbarGroup actions={[{ label: "Info", iconPath: "mdi-test", brand: "info" }]} />);
      expect(screen.getByRole("button", { name: "Info" })).toHaveClass("nxm-button-info");
    });

    it("merges custom className with the base group class", () => {
      const { container } = render(<ToolbarGroup actions={makeActions(1)} className="my-group" />);
      expect(container.firstChild).toHaveClass("nxm-toolbar-group", "my-group");
    });
  });

  describe("interactions", () => {
    it("calls an action's onClick when its button is clicked", async () => {
      const onClick = vi.fn();
      render(<ToolbarGroup actions={[{ label: "Go", iconPath: "mdi-test", onClick }]} />);
      await userEvent.click(screen.getByRole("button", { name: "Go" }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("disables a button and suppresses its onClick when the action is disabled", async () => {
      const onClick = vi.fn();
      render(
        <ToolbarGroup
          actions={[{ label: "Nope", iconPath: "mdi-test", onClick, disabled: true }]}
        />,
      );
      const button = screen.getByRole("button", { name: "Nope" });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("overflow", () => {
    it("does not render a kebab when the action count is within maxVisible", () => {
      render(<ToolbarGroup actions={makeActions(7)} maxVisible={7} />);
      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(queryKebab()).not.toBeInTheDocument();
    });

    it("collapses the tail into a kebab once maxVisible is exceeded", () => {
      render(<ToolbarGroup actions={makeActions(8)} maxVisible={7} />);
      // 6 visible action buttons + the kebab = 7 slots.
      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(screen.getByRole("button", { name: "Action 6" })).toBeInTheDocument();
      expect(getKebab()).toBeInTheDocument();
      // Overflow actions are not rendered until the menu opens.
      expect(screen.queryByText("Action 7")).not.toBeInTheDocument();
      expect(screen.queryByText("Action 8")).not.toBeInTheDocument();
    });

    it("reveals the overflow actions when the kebab is opened", async () => {
      render(<ToolbarGroup actions={makeActions(8)} maxVisible={7} />);
      await userEvent.click(getKebab());
      expect(screen.getByText("Action 7")).toBeInTheDocument();
      expect(screen.getByText("Action 8")).toBeInTheDocument();
    });

    it("calls an overflowed action's onClick from the menu, then dismisses it", async () => {
      const onClick = vi.fn();
      const actions = [...makeActions(7), { label: "Overflowed", iconPath: "mdi-test", onClick }];
      render(<ToolbarGroup actions={actions} maxVisible={7} />);
      await userEvent.click(getKebab());
      await userEvent.click(screen.getByText("Overflowed"));
      expect(onClick).toHaveBeenCalledOnce();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("moves the roving focus with the arrow keys", async () => {
      render(<ToolbarGroup actions={makeActions(9)} maxVisible={7} />);
      await userEvent.click(getKebab());

      // Opening the menu puts focus on its first row.
      expect(screen.getByRole("menuitem", { name: "Action 7" })).toHaveFocus();

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Action 8" })).toHaveFocus();

      await userEvent.keyboard("{ArrowUp}{ArrowUp}");
      expect(screen.getByRole("menuitem", { name: "Action 9" })).toHaveFocus();
    });

    it("respects a custom maxVisible", () => {
      render(<ToolbarGroup actions={makeActions(5)} maxVisible={3} />);
      // 2 visible action buttons + the kebab = 3 slots.
      expect(screen.getAllByRole("button")).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Action 2" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Action 3" })).not.toBeInTheDocument();
      expect(getKebab()).toBeInTheDocument();
    });

    it("never collapses when maxVisible is omitted", () => {
      render(<ToolbarGroup actions={makeActions(10)} />);
      expect(screen.getAllByRole("button")).toHaveLength(10);
      expect(queryKebab()).not.toBeInTheDocument();
    });
  });

  describe("panel actions", () => {
    const panelAction: IToolbarAction = {
      label: "Display options",
      iconPath: "mdi-test",
      panel: ({ close }) => (
        <>
          <span>Panel content</span>

          <button type="button">Toggle something</button>

          <button type="button" onClick={close}>
            Reset to default
          </button>
        </>
      ),
    };

    /** The action collapsed into the overflow, with the menu already open. */
    const openOverflow = async () => {
      render(<ToolbarGroup actions={[...makeActions(7), panelAction]} maxVisible={7} />);
      await userEvent.click(getKebab());

      return screen.getByRole("menuitem", { name: "Display options" });
    };

    // Headless UI's Popover renders a hidden sentinel span beside its own element
    // until it has resolved its root container, so a panel action briefly occupies
    // two slots in the row. Measuring must not be thrown off by that.
    it("measures a group holding a panel action against the same budget", () => {
      stubLayout(100);
      render(
        <Toolbar>
          <ToolbarGroup actions={[...makeActions(4), panelAction]} />
        </Toolbar>,
      );

      // 100px holds three 28px controls: two actions plus the kebab.
      expect(countActionButtons()).toBe(2);
      expect(getKebab()).toBeInTheDocument();
    });

    it("renders a panel action as an ordinary toolbar button", () => {
      render(<ToolbarGroup actions={[panelAction]} />);
      expect(screen.getByRole("button", { name: "Display options" })).toBeInTheDocument();
      expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
    });

    it("opens the panel from the toolbar button", async () => {
      render(<ToolbarGroup actions={[panelAction]} />);
      await userEvent.click(screen.getByRole("button", { name: "Display options" }));
      expect(screen.getByText("Panel content")).toBeInTheDocument();
    });

    // Headless UI returns focus to the trigger after the click that opened the
    // panel, which the tooltip would otherwise read as a cue to reappear — over
    // the panel.
    it("holds the trigger's tooltip back while the panel is open", async () => {
      render(<ToolbarGroup actions={[panelAction]} />);
      const trigger = screen.getByRole("button", { name: "Display options" });

      await userEvent.click(trigger);
      await userEvent.hover(trigger);

      await expect(screen.findByRole("tooltip", {}, { timeout: 400 })).rejects.toThrow();
    });

    it("lets the panel's own content close it", async () => {
      render(<ToolbarGroup actions={[panelAction]} />);
      await userEvent.click(screen.getByRole("button", { name: "Display options" }));
      await userEvent.click(screen.getByRole("button", { name: "Reset to default" }));
      await waitFor(() => expect(screen.queryByText("Panel content")).not.toBeInTheDocument());
    });

    it("opens the panel from the overflow menu, alongside the row", async () => {
      const row = await openOverflow();

      expect(row).toHaveAttribute("aria-haspopup", "dialog");

      await userEvent.click(row);
      expect(screen.getByText("Panel content")).toBeInTheDocument();
    });

    // The regression this whole arrangement exists for: a Menu closes as soon as
    // focus reaches a surface nested inside it, taking the panel with it.
    it("keeps the overflow menu open behind the panel", async () => {
      await userEvent.click(await openOverflow());

      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Action 7" })).toBeInTheDocument();
    });

    it("holds the row in the hover state while its panel is open", async () => {
      const row = await openOverflow();

      expect(row).not.toHaveClass("nxm-dropdown-item-focus");

      await userEvent.click(row);
      expect(row).toHaveClass("nxm-dropdown-item-focus");
    });

    it("keeps both open while the panel's controls are used", async () => {
      await userEvent.click(await openOverflow());
      await userEvent.click(screen.getByRole("button", { name: "Toggle something" }));

      expect(screen.getByText("Panel content")).toBeInTheDocument();
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("opens the panel from the overflow row with ArrowRight", async () => {
      const row = await openOverflow();

      await userEvent.keyboard("{ArrowDown}");
      expect(row).toHaveFocus();

      await userEvent.keyboard("{ArrowRight}");
      expect(screen.getByText("Panel content")).toBeInTheDocument();
    });
  });

  describe("tooltips", () => {
    const getTooltip = () => screen.queryByRole("tooltip");

    /** Tooltips open on a delay, so absence has to outlast it to mean anything. */
    const expectNoTooltip = async () => {
      await expect(screen.findByRole("tooltip", {}, { timeout: 400 })).rejects.toThrow();
    };

    it("shows a tooltip with the label when a visible control is hovered", async () => {
      render(<ToolbarGroup actions={[{ label: "Update extensions", iconPath: "mdi-test" }]} />);

      expect(getTooltip()).not.toBeInTheDocument();

      await userEvent.hover(screen.getByRole("button", { name: "Update extensions" }));

      expect(await screen.findByRole("tooltip")).toHaveTextContent("Update extensions");
    });

    it("hides the tooltip again once the pointer leaves", async () => {
      render(<ToolbarGroup actions={[{ label: "Refresh", iconPath: "mdi-test" }]} />);
      const button = screen.getByRole("button", { name: "Refresh" });

      await userEvent.hover(button);
      expect(await screen.findByRole("tooltip")).toBeInTheDocument();

      await userEvent.unhover(button);
      await waitFor(() => expect(getTooltip()).not.toBeInTheDocument());
    });

    it("gives an overflowed action no tooltip, since the dropdown shows its label", async () => {
      render(<ToolbarGroup actions={makeActions(8)} maxVisible={7} />);
      await userEvent.click(getKebab());

      await userEvent.hover(screen.getByText("Action 8"));

      await expectNoTooltip();
    });

    it("gives a showLabel action no tooltip repeating its visible text", async () => {
      render(
        <ToolbarGroup actions={[{ label: "1 selected", iconPath: "mdi-test", showLabel: true }]} />,
      );

      await userEvent.hover(screen.getByRole("button", { name: "1 selected" }));

      await expectNoTooltip();
    });

    it("keeps one accessible name per control, not a name plus a duplicate", async () => {
      render(<ToolbarGroup actions={[{ label: "Refresh", iconPath: "mdi-test" }]} />);
      const button = screen.getByRole("button", { name: "Refresh" });

      // Icon-only, so the name comes from aria-label and nothing else.
      expect(button).toHaveAttribute("aria-label", "Refresh");
      expect(button).not.toHaveTextContent("Refresh");

      // While open the tooltip describes the control; it must not rename it.
      await userEvent.hover(button);
      await screen.findByRole("tooltip");

      expect(screen.getByRole("button", { name: "Refresh" })).toBe(button);
      expect(button).toHaveAttribute("aria-label", "Refresh");
    });

    it("labels a showLabel action from its visible text, with no aria-label", () => {
      render(<ToolbarGroup actions={[{ label: "1 selected", showLabel: true }]} />);
      const button = screen.getByRole("button", { name: "1 selected" });

      expect(button).not.toHaveAttribute("aria-label");
      expect(button).toHaveTextContent("1 selected");
    });
  });

  describe("width-based overflow", () => {
    // The stubs give every control a 28px width with no gap or padding, so a row
    // of N pixels holds floor(N / 28) controls — the kebab being one of them.
    const renderRow = (rowPixels: number, actionCount = 5) => {
      stubLayout(rowPixels);
      render(
        <Toolbar>
          <ToolbarGroup actions={makeActions(actionCount)} />
        </Toolbar>,
      );
    };

    it("keeps every action when the row has room for them all", () => {
      renderRow(200);
      expect(countActionButtons()).toBe(5);
      expect(queryKebab()).not.toBeInTheDocument();
    });

    it("collapses the actions that don't fit, leaving room for the kebab", () => {
      renderRow(100);
      // 5 actions need 140px. Two actions plus the kebab is 84px; three would be 112px.
      expect(countActionButtons()).toBe(2);
      expect(getKebab()).toBeInTheDocument();
    });

    it("puts the actions that didn't fit into the kebab's dropdown", async () => {
      renderRow(100);
      await userEvent.click(getKebab());
      expect(screen.getByText("Action 3")).toBeInTheDocument();
      expect(screen.getByText("Action 5")).toBeInTheDocument();
    });

    it("collapses further as the row narrows", () => {
      renderRow(200);
      expect(countActionButtons()).toBe(5);

      resizeRowTo(100);
      expect(countActionButtons()).toBe(2);
    });

    it("restores the collapsed actions when the row grows again", () => {
      renderRow(100);
      expect(countActionButtons()).toBe(2);

      resizeRowTo(200);
      expect(countActionButtons()).toBe(5);
      expect(queryKebab()).not.toBeInTheDocument();
    });

    it("shows only the kebab when not even one action fits", () => {
      renderRow(40);
      expect(countActionButtons()).toBe(0);
      expect(getKebab()).toBeInTheDocument();
    });

    it("still honours maxVisible as a ceiling on a wide row", () => {
      stubLayout(1000);
      render(
        <Toolbar>
          <ToolbarGroup actions={makeActions(10)} maxVisible={4} />
        </Toolbar>,
      );
      expect(countActionButtons()).toBe(3);
      expect(getKebab()).toBeInTheDocument();
    });
  });

  describe("a toolbar that doesn't offer pinning", () => {
    it("shows every action it was given, `pinned` or not", () => {
      // `pinned` is a default for a toolbar that lets the user decide; without
      // `pinningId` there is nobody to decide, so it means nothing here.
      stubLayout(1000);
      render(
        <Toolbar>
          <ToolbarGroup
            actions={makeActions(5).map((action, index) => ({
              ...action,
              id: `action-${index}`,
              pinned: index === 0,
            }))}
          />
        </Toolbar>,
      );

      expect(countActionButtons()).toBe(5);
      expect(queryKebab()).not.toBeInTheDocument();
    });
  });

  describe("a toolbar that offers pinning", () => {
    const pinnable = (specs: Array<[label: string, pinned: boolean]>): IToolbarAction[] =>
      specs.map(([label, pinned]) => ({
        id: label.toLowerCase().replace(/ /g, "-"),
        iconPath: "mdi-test",
        label,
        pinned,
      }));

    const renderToolbar = ({
      actions,
      decisions = {},
      width = 1000,
      tracking,
    }: {
      actions: IToolbarAction[];
      decisions?: { [actionId: string]: boolean };
      width?: number;
      tracking?: Partial<IToolbarAnalytics>;
    }) => {
      stubLayout(width);
      const store = makeStore({ mods: { pinned: decisions } });

      render(
        <Provider store={store as never}>
          <Toolbar pinningId="mods" tracking={tracking && { ...silentTracking(), ...tracking }}>
            <ToolbarGroup actions={actions} />
          </Toolbar>
        </Provider>,
      );

      return store;
    };

    /**
     * The controls on the bar, by name. Scoped to the row because the menu's panel is
     * portalled out of it, so its rows and their pins can't be mistaken for controls.
     */
    const barLabels = () =>
      within(screen.getByRole("toolbar"))
        .getAllByRole("button")
        .filter((button) => button.dataset.testid !== KEBAB_TEST_ID)
        .map((button) => button.getAttribute("aria-label"));

    const openMenu = () => userEvent.click(getKebab());

    const menuLabels = () => screen.getAllByRole("menuitem").map((row) => row.textContent?.trim());

    const rowFor = (label: string) => {
      const row = screen
        .getAllByRole("menuitem")
        .find((item) => item.textContent?.trim() === label);

      if (row === undefined) {
        throw new Error(`the menu has no row for "${label}"`);
      }

      return row;
    };

    /**
     * The pin toggle on a row, reached through the row rather than by its own name:
     * `t` returns the key uninterpolated here, so every pin reads alike — the same
     * reason the kebab is found by test id.
     */
    const pinOf = (label: string) => within(rowFor(label)).getByRole("button");

    /**
     * The reset link, which sits below the menu rather than in it — the same shape the
     * display options panel ends in.
     */
    const queryResetLink = () => screen.queryByRole("button", { name: "Reset pins to default" });

    const resetLink = () => screen.getByRole("button", { name: "Reset pins to default" });

    it("puts the pinned actions on the bar, and every action in the menu", async () => {
      renderToolbar({
        actions: pinnable([
          ["Deploy", true],
          ["Purge", false],
          ["History", true],
        ]),
      });

      expect(barLabels()).toEqual(["Deploy", "History"]);

      await openMenu();
      expect(menuLabels()).toEqual(["Deploy", "Purge", "History"]);
    });

    it("keeps the menu there even when the bar has room to spare", () => {
      // Everything the bar holds fits, but the menu is the only way to reach an
      // unpinned action, so it can't come and go with the width.
      renderToolbar({ actions: pinnable([["Deploy", true]]) });

      expect(barLabels()).toEqual(["Deploy"]);
      expect(getKebab()).toBeInTheDocument();
    });

    it("follows what the user decided over what the action asks for", () => {
      renderToolbar({
        actions: pinnable([
          ["Deploy", false],
          ["Purge", true],
        ]),
        decisions: { deploy: true, purge: false },
      });

      expect(barLabels()).toEqual(["Deploy"]);
    });

    it("gives every row a toggle saying whether that action is pinned", async () => {
      renderToolbar({
        actions: pinnable([
          ["Deploy", true],
          ["Purge", false],
        ]),
      });

      await openMenu();

      expect(pinOf("Deploy")).toHaveAttribute("aria-pressed", "true");
      expect(pinOf("Purge")).toHaveAttribute("aria-pressed", "false");
    });

    it("puts a pinned action on the bar at its own position, not at the end", async () => {
      renderToolbar({
        actions: pinnable([
          ["Deploy", true],
          ["Purge", false],
          ["History", true],
        ]),
      });

      await openMenu();
      await userEvent.click(pinOf("Purge"));

      await waitFor(() => expect(barLabels()).toEqual(["Deploy", "Purge", "History"]));
    });

    it("takes an unpinned action off the bar, leaving it in the menu", async () => {
      renderToolbar({
        actions: pinnable([
          ["Deploy", true],
          ["History", true],
        ]),
      });

      await openMenu();
      await userEvent.click(pinOf("Deploy"));

      await waitFor(() => expect(barLabels()).toEqual(["History"]));
      expect(menuLabels()).toEqual(["Deploy", "History"]);
    });

    it("stores a decision under the action's id, so a translated label can't key it", async () => {
      const store = renderToolbar({ actions: pinnable([["Deploy Mods", true]]) });

      await openMenu();
      await userEvent.click(pinOf("Deploy Mods"));

      expect(store.getState().settings.toolbars).toEqual({
        mods: { pinned: { "deploy-mods": false } },
      });
    });

    it("offers no toggle for an action it could not store a decision about", async () => {
      // Without an id there is nothing to key a decision on, so the action stays on
      // the bar rather than being offered a toggle that would do nothing.
      renderToolbar({
        actions: [{ iconPath: "mdi-test", label: "Nameless" }, ...pinnable([["Deploy", true]])],
      });

      expect(barLabels()).toEqual(["Nameless", "Deploy"]);

      await openMenu();
      expect(within(rowFor("Nameless")).queryByRole("button")).not.toBeInTheDocument();
      expect(pinOf("Deploy")).toBeInTheDocument();
    });

    describe("resetting to defaults", () => {
      it("offers no reset until the user has decided something", async () => {
        renderToolbar({ actions: pinnable([["Deploy", true]]) });

        await openMenu();
        expect(queryResetLink()).not.toBeInTheDocument();
      });

      it("offers one once a decision has been made", async () => {
        renderToolbar({ actions: pinnable([["Deploy", true]]), decisions: { deploy: false } });

        await openMenu();
        expect(resetLink()).toBeInTheDocument();
      });

      // The pins above move back, which is the confirmation — and with nothing left to
      // undo the link takes itself away.
      it("puts the bar back, leaves the menu open, and removes itself", async () => {
        renderToolbar({ actions: pinnable([["Deploy", true]]), decisions: { deploy: false } });

        await openMenu();
        expect(barLabels()).toEqual([]);

        await userEvent.click(resetLink());

        expect(barLabels()).toEqual(["Deploy"]);
        expect(screen.getByRole("menu")).toBeInTheDocument();
        expect(queryResetLink()).not.toBeInTheDocument();
      });
    });

    describe("tracking", () => {
      it("reports a pin, and the unpin that undoes it", async () => {
        const onPinChange = vi.fn();
        renderToolbar({ actions: pinnable([["Deploy", false]]), tracking: { onPinChange } });

        await openMenu();
        await userEvent.click(pinOf("Deploy"));

        expect(onPinChange).toHaveBeenLastCalledWith({ id: "deploy", extension: undefined }, true);

        await userEvent.click(pinOf("Deploy"));

        expect(onPinChange).toHaveBeenLastCalledWith({ id: "deploy", extension: undefined }, false);
      });

      it("reports a reset to defaults", async () => {
        const onPinsReset = vi.fn();
        renderToolbar({
          actions: pinnable([["Deploy", false]]),
          decisions: { deploy: true },
          tracking: { onPinsReset },
        });

        await openMenu();
        await userEvent.click(resetLink());

        expect(onPinsReset).toHaveBeenCalledOnce();
      });

      it("says nothing on a toolbar that isn't tracked", async () => {
        renderToolbar({ actions: pinnable([["Deploy", false]]) });

        await openMenu();
        await userEvent.click(pinOf("Deploy"));

        expect(screen.getByRole("toolbar")).toBeInTheDocument();
      });
    });
  });
});

describe("fitVisibleActions", () => {
  // A mixed row: four icon-only controls and one wide labelled one.
  const metrics: IToolbarGroupMetrics = {
    itemWidths: [28, 28, 28, 92, 28],
    kebabWidth: 28,
    gap: 8,
    padding: 8,
  };

  /** Visible indices, ascending, so the expectations read as positions. */
  const fit = (availableWidth: number | null, maxVisible?: number) =>
    [
      ...fitVisibleActions({
        actionCount: metrics.itemWidths.length,
        availableWidth,
        maxVisible,
        metrics,
      }),
    ].sort((a, b) => a - b);

  it("shows everything when it all fits", () => {
    // 204px of controls + 32px of gaps + 8px of padding = 244px.
    expect(fit(300)).toEqual([0, 1, 2, 3, 4]);
    expect(fit(244)).toEqual([0, 1, 2, 3, 4]);
  });

  it("drops actions from the end as the budget tightens", () => {
    expect(fit(243)).toEqual([0, 1, 2]); // 4 actions include the 92px one, so it skips to 3.
    expect(fit(144)).toEqual([0, 1, 2]);
    expect(fit(143)).toEqual([0, 1]);
    expect(fit(100)).toEqual([0]);
  });

  it("keeps only the kebab when nothing fits alongside it", () => {
    expect(fit(50)).toEqual([]);
    expect(fit(0)).toEqual([]);
  });

  it("ignores width when it hasn't been measured", () => {
    expect(fit(null)).toEqual([0, 1, 2, 3, 4]);
    expect(fit(null, 3)).toEqual([0, 1]);
  });

  it("takes whichever of width and maxVisible is more restrictive", () => {
    expect(fit(300, 3)).toEqual([0, 1]); // The cap wins: 2 actions plus the kebab is 3 slots.
    expect(fit(100, 3)).toEqual([0]); // The width wins.
  });

  it("treats missing metrics as unconstrained", () => {
    expect([
      ...fitVisibleActions({
        actionCount: metrics.itemWidths.length,
        availableWidth: 10,
        metrics: null,
      }),
    ]).toEqual([0, 1, 2, 3, 4]);
  });

  describe("a menu that is always there", () => {
    /** As a toolbar offering pinning is: its menu holds the full list regardless. */
    const fitBesideMenu = (availableWidth: number | null, maxVisible?: number) =>
      [
        ...fitVisibleActions({
          actionCount: metrics.itemWidths.length,
          alwaysReserveOverflow: true,
          availableWidth,
          maxVisible,
          metrics,
        }),
      ].sort((a, b) => a - b);

    it("spends part of the budget on the kebab even when everything would fit", () => {
      // Without a kebab, all five come to 204 + 32 gaps + 8 padding = 244px. With one
      // they need 280, so at 244 the last action goes: four plus the kebab is exactly
      // 176 + 28 + 32 + 8 = 244, and a pixel less drops the 92px one too.
      expect(fit(244)).toEqual([0, 1, 2, 3, 4]);
      expect(fitBesideMenu(280)).toEqual([0, 1, 2, 3, 4]);
      expect(fitBesideMenu(244)).toEqual([0, 1, 2, 3]);
      expect(fitBesideMenu(243)).toEqual([0, 1, 2]);
    });

    it("counts the kebab against the maxVisible ceiling", () => {
      expect(fitBesideMenu(null, 3)).toEqual([0, 1]);
    });

    it("gives up every action when the budget only covers the kebab", () => {
      expect(fitBesideMenu(40)).toEqual([]);
    });
  });
});

describe("click tracking", () => {
  const trackedToolbar = (actions: IToolbarAction[], onActionClick: () => void, max?: number) =>
    render(
      <Toolbar tracking={{ ...silentTracking(), onActionClick }}>
        <ToolbarGroup actions={actions} maxVisible={max} />
      </Toolbar>,
    );

  it("reports a visible action's click, and still runs it exactly once", async () => {
    const onActionClick = vi.fn();
    const onClick = vi.fn();
    trackedToolbar([{ label: "Deploy", id: "deploy", onClick }], onActionClick);

    await userEvent.click(screen.getByRole("button", { name: "Deploy" }));

    expect(onActionClick).toHaveBeenCalledWith({ id: "deploy", extension: undefined }, "bar");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("reports an overflowed action against the overflow, not the bar", async () => {
    const onActionClick = vi.fn();
    const onClick = vi.fn();
    const actions = [...makeActions(7), { label: "Overflowed", id: "overflowed", onClick }];
    trackedToolbar(actions, onActionClick, 7);

    await userEvent.click(getKebab());
    await userEvent.click(screen.getByText("Overflowed"));

    expect(onActionClick).toHaveBeenCalledWith(
      { id: "overflowed", extension: undefined },
      "overflow",
    );
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("names the extension an action came from", async () => {
    const onActionClick = vi.fn();
    trackedToolbar(
      [
        {
          label: "Manage Rules",
          id: "Manage Rules",
          extension: "mod-dependency-manager",
          onClick: vi.fn(),
        },
      ],
      onActionClick,
    );

    await userEvent.click(screen.getByRole("button", { name: "Manage Rules" }));

    expect(onActionClick).toHaveBeenCalledWith(
      { id: "Manage Rules", extension: "mod-dependency-manager" },
      "bar",
    );
  });

  // The label is the only other thing to hand, and it is translated. Reporting an action
  // under a name that changes with the language would split one button across as many
  // ids as there are locales, which is worse than not reporting it at all. An action
  // without an id cannot be pinned either — see `useToolbarPinning`.
  it("says nothing about an action that has no id, but still runs it", async () => {
    const onActionClick = vi.fn();
    const onClick = vi.fn();
    trackedToolbar([{ label: "Nameless", onClick }], onActionClick);

    await userEvent.click(screen.getByRole("button", { name: "Nameless" }));

    expect(onActionClick).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  // An empty id is no identity at all — reporting it would put `action: ""` in the
  // dashboard, which reads as a real button nobody can name.
  it("treats an empty id as no identity", async () => {
    const onActionClick = vi.fn();
    const onClick = vi.fn();
    trackedToolbar([{ label: "Blank", id: "", onClick }], onActionClick);

    await userEvent.click(screen.getByRole("button", { name: "Blank" }));

    expect(onActionClick).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("leaves an untracked toolbar's actions alone", async () => {
    const onClick = vi.fn();
    render(
      <Toolbar>
        <ToolbarGroup actions={[{ label: "Deploy", id: "deploy", onClick }]} />
      </Toolbar>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Deploy" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  describe("panel actions", () => {
    const panelAction: IToolbarAction = {
      label: "Open",
      id: "open",
      panel: () => <span>Panel content</span>,
    };

    it("counts opening the panel as a click on the control", async () => {
      const onActionClick = vi.fn();
      trackedToolbar([panelAction], onActionClick);

      await userEvent.click(screen.getByRole("button", { name: "Open" }));

      expect(screen.getByText("Panel content")).toBeInTheDocument();
      expect(onActionClick).toHaveBeenCalledWith({ id: "open", extension: undefined }, "bar");
    });

    it("does not count closing it again as a second click", async () => {
      const onActionClick = vi.fn();
      trackedToolbar([panelAction], onActionClick);

      const trigger = screen.getByRole("button", { name: "Open" });
      await userEvent.click(trigger);
      await userEvent.click(trigger);

      expect(onActionClick).toHaveBeenCalledOnce();
    });
  });
});
