import { mdiChevronRight, mdiPinOffOutline, mdiPinOutline } from "@mdi/js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Popover } from "./Popover";
import { PopoverButton } from "./PopoverButton";
import { PopoverMenu } from "./PopoverMenu";
import type { IMenuAction } from "./PopoverMenuItem";
import { PopoverPanel } from "./PopoverPanel";

// --- Helpers ---

/** A menu hung off a trigger, the way both the header and the toolbar overflow use it. */
const renderMenu = (actions: IMenuAction[][]) => {
  render(
    <Popover>
      <PopoverButton>Account</PopoverButton>

      <PopoverPanel className="nxm-popover-panel-dropdown">
        {({ close }) => <PopoverMenu actions={actions} label="Account" onSelect={close} />}
      </PopoverPanel>
    </Popover>,
  );

  return { trigger: screen.getByRole("button", { name: "Account" }) };
};

const openMenu = async (actions: IMenuAction[][]) => {
  const { trigger } = renderMenu(actions);
  await userEvent.click(trigger);

  return { trigger };
};

const plainAction = (label: string, onClick = () => {}): IMenuAction => ({
  iconPath: "mdi-test",
  label,
  onClick,
});

/** A row whose panel is itself a menu — the header's nested Help submenu. */
const submenuAction = (rows: IMenuAction[][], onDismissSpy?: () => void): IMenuAction => ({
  iconPath: "mdi-help",
  label: "Help",
  panelRole: "menu",
  panel: ({ close, dismiss }) => (
    <PopoverMenu
      actions={rows}
      label="Help"
      onClose={close}
      onSelect={() => {
        onDismissSpy?.();
        dismiss();
      }}
    />
  ),
});

const helpRows: IMenuAction[][] = [[plainAction("Help centre"), plainAction("About")]];

// --- Tests ---

describe("PopoverMenu", () => {
  describe("rendering", () => {
    it("renders each action as a menu item", async () => {
      await openMenu([[plainAction("View profile"), plainAction("Logout")]]);

      expect(screen.getByRole("menuitem", { name: "View profile" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
    });

    it("names the menu for assistive technology", async () => {
      await openMenu([[plainAction("Logout")]]);
      expect(screen.getByRole("menu")).toHaveAccessibleName("Account");
    });

    it("separates groups with a rule", async () => {
      await openMenu([[plainAction("View profile")], [plainAction("Logout")]]);
      expect(screen.getAllByRole("separator")).toHaveLength(1);
    });

    it("draws no rule around an empty group", async () => {
      // The header hands over its extension-contributed group as-is, and it is
      // empty unless a third-party extension has registered something.
      await openMenu([[], [plainAction("Help centre")], []]);

      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Help centre" })).toBeInTheDocument();
    });

    it("disables a disabled action", async () => {
      await openMenu([[{ ...plainAction("Logout"), disabled: true }]]);
      expect(screen.getByRole("menuitem", { name: "Logout" })).toBeDisabled();
    });

    it("brands a row that asks for it", async () => {
      await openMenu([[{ ...plainAction("Deploy Mods"), brand: "primary" }]]);

      expect(screen.getByRole("menuitem", { name: "Deploy Mods" })).toHaveClass(
        "nxm-dropdown-item-primary",
      );
    });

    it("brands a destructive row", async () => {
      await openMenu([[{ ...plainAction("Remove"), brand: "danger" }]]);

      expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveClass(
        "nxm-dropdown-item-danger",
      );
    });

    it("brands a row whose panel is a submenu", async () => {
      await openMenu([[{ ...submenuAction(helpRows), brand: "premium" }]]);

      expect(screen.getByRole("menuitem", { name: "Help" })).toHaveClass(
        "nxm-dropdown-item-premium",
      );
    });

    it("leaves a row alone when it asks for no brand", async () => {
      await openMenu([[plainAction("Logout")]]);

      expect(screen.getByRole("menuitem", { name: "Logout" }).className).not.toMatch(
        /nxm-dropdown-item-(primary|info|neutral|success|premium)/,
      );
    });
  });

  describe("interactions", () => {
    it("runs an action and dismisses the menu", async () => {
      const onClick = vi.fn();
      await openMenu([[plainAction("Logout", onClick)]]);

      await userEvent.click(screen.getByRole("menuitem", { name: "Logout" }));

      expect(onClick).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("focuses the first row on open", async () => {
      await openMenu([[plainAction("View profile"), plainAction("Logout")]]);
      expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
    });

    // Focus is what the row's highlight follows, so hovering has to move it or the
    // pointer and the arrow keys would light up two different rows.
    it("hands focus to a hovered row", async () => {
      await openMenu([[plainAction("View profile"), plainAction("Logout")]]);

      await userEvent.hover(screen.getByRole("menuitem", { name: "Logout" }));
      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();
    });

    it("carries on arrowing from the row the pointer left off at", async () => {
      await openMenu([
        [plainAction("View profile"), plainAction("Refresh"), plainAction("Logout")],
      ]);

      await userEvent.hover(screen.getByRole("menuitem", { name: "Refresh" }));
      await userEvent.keyboard("{ArrowDown}");

      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();
    });
  });

  // The highlight is state the menu keeps, not a `:hover` or `:focus-visible` rule,
  // so exactly one row can ever wear it however the pointer and keyboard are mixed.
  describe("the focused row", () => {
    const focusedRows = () =>
      screen
        .getAllByRole("menuitem")
        .filter((row) => row.classList.contains("nxm-dropdown-item-focus"))
        .map((row) => row.textContent?.trim());

    it("marks the row the menu opened on", async () => {
      await openMenu([[plainAction("View profile"), plainAction("Logout")]]);
      expect(focusedRows()).toEqual(["View profile"]);
    });

    it("moves with the arrow keys, and only ever marks one", async () => {
      await openMenu([
        [plainAction("View profile"), plainAction("Refresh")],
        [plainAction("Logout")],
      ]);

      await userEvent.keyboard("{ArrowDown}");
      expect(focusedRows()).toEqual(["Refresh"]);

      await userEvent.keyboard("{ArrowDown}");
      expect(focusedRows()).toEqual(["Logout"]);
    });

    it("follows the pointer to a hovered row", async () => {
      await openMenu([[plainAction("View profile"), plainAction("Logout")]]);

      await userEvent.hover(screen.getByRole("menuitem", { name: "Logout" }));
      expect(focusedRows()).toEqual(["Logout"]);
    });

    // The case a `:hover` rule got wrong: the pointer stays put while the keyboard
    // moves on, and the row under it must give the highlight up.
    it("leaves a hovered row behind when the keyboard moves on", async () => {
      await openMenu([
        [plainAction("View profile"), plainAction("Refresh"), plainAction("Logout")],
      ]);

      await userEvent.hover(screen.getByRole("menuitem", { name: "Refresh" }));
      await userEvent.keyboard("{ArrowDown}");

      expect(focusedRows()).toEqual(["Logout"]);
    });
  });

  describe("roving focus", () => {
    // Groups are a visual device only, so arrowing has to run through the whole
    // menu rather than stopping at a rule.
    const grouped: IMenuAction[][] = [
      [plainAction("View profile")],
      [plainAction("Refresh"), plainAction("Help centre")],
      [plainAction("Logout")],
    ];

    it("moves across group boundaries with ArrowDown", async () => {
      await openMenu(grouped);

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Refresh" })).toHaveFocus();

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();
    });

    it("wraps from the last row back to the first", async () => {
      await openMenu(grouped);

      await userEvent.keyboard("{ArrowUp}");
      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
    });

    it("jumps to the last and first rows with End and Home", async () => {
      await openMenu(grouped);

      await userEvent.keyboard("{End}");
      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();

      await userEvent.keyboard("{Home}");
      expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveFocus();
    });

    it("skips a disabled row", async () => {
      await openMenu([
        [plainAction("View profile"), { ...plainAction("Refresh"), disabled: true }],
        [plainAction("Logout")],
      ]);

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();
    });

    // A row can hold a control of its own, and arrowing from there has to carry on
    // from that row. Read as "no row at all", ArrowDown went to the first row and
    // ArrowUp to the last, wherever you were.
    it("carries on from the row a focused control belongs to", async () => {
      const pinnable = (label: string): IMenuAction => ({
        ...plainAction(label),
        pin: { pinned: false, label: `Pin ${label}`, onToggle: () => {} },
      });

      await openMenu([[pinnable("View profile"), pinnable("Refresh"), pinnable("Logout")]]);

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Refresh" })).toHaveFocus();

      screen.getByRole("button", { name: "Pin Refresh" }).focus();

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Logout" })).toHaveFocus();

      screen.getByRole("button", { name: "Pin Logout" }).focus();

      await userEvent.keyboard("{ArrowUp}");
      expect(screen.getByRole("menuitem", { name: "Refresh" })).toHaveFocus();
    });

    /** The path the pin's icon is currently drawing. */
    const pinIconPath = (name: string) =>
      screen.getByRole("button", { name }).querySelector("path")?.getAttribute("d");

    // The icon is an offer, not a report: it shows what the click does, matching the
    // label beside it, rather than the state the row is already in.
    it("offers a pin on a row that is not pinned", async () => {
      await openMenu([
        [
          {
            ...plainAction("Refresh"),
            pin: { pinned: false, label: "Pin Refresh", onToggle: () => {} },
          },
        ],
      ]);

      expect(pinIconPath("Pin Refresh")).toBe(mdiPinOutline);
    });

    it("offers to unpin a row that is pinned", async () => {
      await openMenu([
        [
          {
            ...plainAction("Refresh"),
            pin: { pinned: true, label: "Unpin Refresh", onToggle: () => {} },
          },
        ],
      ]);

      expect(pinIconPath("Unpin Refresh")).toBe(mdiPinOffOutline);
    });
  });

  describe("nested menus", () => {
    /** The account menu open, with its Help row ready to fly out. */
    const openParent = async (onDismissSpy?: () => void) => {
      await openMenu([
        [plainAction("View profile")],
        [plainAction("Refresh"), submenuAction(helpRows, onDismissSpy)],
      ]);

      return screen.getByRole("menuitem", { name: "Help" });
    };

    it("advertises the row's panel as a menu", async () => {
      expect(await openParent()).toHaveAttribute("aria-haspopup", "menu");
    });

    // Without it the row is indistinguishable from one that just runs something.
    it("points a chevron at the surface the row opens", async () => {
      const row = await openParent();

      expect(row.querySelector(`path[d="${mdiChevronRight}"]`)).toBeInTheDocument();
      expect(row.querySelector(".nxm-dropdown-item-chevron-hidden")).not.toBeInTheDocument();
      // Decorative: the chevron must not become part of the row's name.
      expect(row).toHaveAccessibleName("Help");
    });

    // A row that opens nothing keeps the space a chevron would take, so the pins of
    // every row line up, and withholds the mark itself.
    it("hides the chevron on a row that just runs an action", async () => {
      await openMenu([[plainAction("Logout")]]);
      const row = screen.getByRole("menuitem", { name: "Logout" });

      expect(row.querySelector(`path[d="${mdiChevronRight}"]`)).toBeInTheDocument();
      expect(row.querySelector(".nxm-dropdown-item-chevron-hidden")).toBeInTheDocument();
    });

    it("opens the submenu from its row", async () => {
      await userEvent.click(await openParent());
      expect(screen.getByRole("menuitem", { name: "Help centre" })).toBeInTheDocument();
    });

    describe("on hover", () => {
      const submenuOpen = () => screen.queryByRole("menuitem", { name: "Help centre" });

      it("opens the submenu as soon as the pointer arrives", async () => {
        const row = await openParent();

        await userEvent.hover(row);
        expect(submenuOpen()).toBeInTheDocument();
      });

      it("does not open a disabled row", async () => {
        await openMenu([[{ ...submenuAction(helpRows), disabled: true }]]);

        await userEvent.hover(screen.getByRole("menuitem", { name: "Help" }));
        await expect(waitFor(() => expect(submenuOpen()).toBeInTheDocument())).rejects.toThrow();
      });

      it("closes it again once the pointer leaves both the row and its panel", async () => {
        const row = await openParent();

        await userEvent.hover(row);
        await waitFor(() => expect(submenuOpen()).toBeInTheDocument());

        await userEvent.unhover(row);
        await waitFor(() => expect(submenuOpen()).not.toBeInTheDocument());
      });

      // Clicking a row the pointer has already opened must not toggle it shut.
      it("leaves an already-open submenu alone when its row is clicked", async () => {
        const row = await openParent();

        await userEvent.hover(row);
        await waitFor(() => expect(submenuOpen()).toBeInTheDocument());

        await userEvent.click(row);
        expect(submenuOpen()).toBeInTheDocument();
      });

      // The panel is portalled, so leaving the row fires even when the pointer is
      // heading into the panel. Entering it has to call that off.
      it("stays open when the pointer moves from the row into the panel", async () => {
        const row = await openParent();

        await userEvent.hover(row);
        await waitFor(() => expect(submenuOpen()).toBeInTheDocument());

        await userEvent.unhover(row);
        await userEvent.hover(screen.getByRole("menu", { name: "Help" }));

        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(submenuOpen()).toBeInTheDocument();
      });
    });

    // The regression the whole Popover-as-menu arrangement exists for: a Menu
    // closes as soon as focus reaches a surface nested inside it. The submenu
    // focuses its own first row on open, so this is the case that proves it.
    it("keeps the parent menu open once focus moves into the submenu", async () => {
      await userEvent.click(await openParent());

      expect(screen.getByRole("menuitem", { name: "Help centre" })).toHaveFocus();
      expect(screen.getByRole("menuitem", { name: "View profile" })).toBeInTheDocument();
      expect(screen.getAllByRole("menu")).toHaveLength(2);
    });

    it("holds the row in the hover state while its submenu is open", async () => {
      const row = await openParent();

      expect(row).not.toHaveClass("nxm-dropdown-item-focus");

      await userEvent.click(row);
      expect(row).toHaveClass("nxm-dropdown-item-focus");
    });

    it("opens the submenu with ArrowRight and closes it with ArrowLeft", async () => {
      const row = await openParent();

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      expect(row).toHaveFocus();

      await userEvent.keyboard("{ArrowRight}");
      expect(screen.getByRole("menuitem", { name: "Help centre" })).toBeInTheDocument();

      await userEvent.keyboard("{ArrowLeft}");
      await waitFor(() =>
        expect(screen.queryByRole("menuitem", { name: "Help centre" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("arrows within the submenu without moving the parent's focus", async () => {
      await userEvent.click(await openParent());

      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "About" })).toHaveFocus();
    });

    // Picking a help destination ends the interaction, so both surfaces go away —
    // unlike a settings panel, which leaves the menu it was opened from standing.
    it("dismisses both surfaces when a submenu row is chosen", async () => {
      const onDismiss = vi.fn();
      await userEvent.click(await openParent(onDismiss));

      await userEvent.click(screen.getByRole("menuitem", { name: "About" }));

      expect(onDismiss).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });

    it("closes only the submenu on Escape", async () => {
      await userEvent.click(await openParent());
      await userEvent.keyboard("{Escape}");

      await waitFor(() =>
        expect(screen.queryByRole("menuitem", { name: "Help centre" })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("menuitem", { name: "View profile" })).toBeInTheDocument();
    });
  });
});
