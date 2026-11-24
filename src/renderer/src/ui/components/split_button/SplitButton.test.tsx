import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";

import { SplitButton, SplitButtonAction } from "./SplitButton";

const remove = (onClick = vi.fn()) => (
  <SplitButtonAction
    data-testid="split-remove"
    icon="close"
    label="Remove filter"
    onClick={onClick}
  />
);

describe("SplitButton", () => {
  it("shows a main part without a click handler as it is, but not as a button", () => {
    render(
      <SplitButton action={remove()} data-testid="split-main">
        +2 more filter
      </SplitButton>,
    );

    expect(screen.getAllByRole("button")).toEqual([screen.getByTestId("split-remove")]);
    expect(screen.getByTestId("split-main").closest(".nxm-button")).not.toHaveClass(
      "nxm-button-disabled",
    );
  });

  it("makes the main part a button with a click handler", async () => {
    const onClick = vi.fn();
    render(
      <SplitButton action={remove()} data-testid="split-main" onClick={onClick}>
        Date added
      </SplitButton>,
    );

    await userEvent.click(screen.getByTestId("split-main"));

    expect(onClick).toHaveBeenCalled();
  });

  it("runs the second part on its own", async () => {
    const onMain = vi.fn();
    const onRemove = vi.fn();
    render(
      <SplitButton action={remove(onRemove)} onClick={onMain}>
        Date added
      </SplitButton>,
    );

    await userEvent.click(screen.getByTestId("split-remove"));

    expect(onRemove).toHaveBeenCalled();
    expect(onMain).not.toHaveBeenCalled();
  });

  it("takes a menu built outside it around its second part", async () => {
    const onRename = vi.fn();
    render(
      <SplitButton
        action={
          <Popover className="flex">
            <HeadlessPopoverButton
              as={SplitButtonAction}
              data-testid="split-options"
              icon="keyboard_arrow_down"
              label="More options"
            />

            <PopoverPanel>
              {({ close }) => (
                <PopoverMenu
                  actions={[[{ label: "Rename", testId: "split-rename", onClick: onRename }]]}
                  label="More options"
                  onSelect={close}
                />
              )}
            </PopoverPanel>
          </Popover>
        }
        onClick={vi.fn()}
      >
        My view
      </SplitButton>,
    );

    await userEvent.click(screen.getByTestId("split-options"));
    await userEvent.click(await screen.findByTestId("split-rename"));

    expect(onRename).toHaveBeenCalled();
  });

  it("opens a panel from the main part, leaving the second part to run on its own", async () => {
    const onRemove = vi.fn();
    const onPick = vi.fn();
    render(
      <SplitButton
        action={remove(onRemove)}
        panel={({ close }) => (
          <PopoverMenu
            actions={[[{ label: "7 days", testId: "split-seven-days", onClick: onPick }]]}
            label="Dates"
            onSelect={close}
          />
        )}
        data-testid="split-main"
        panelRole="menu"
      >
        Date added
      </SplitButton>,
    );

    await userEvent.click(screen.getByTestId("split-remove"));

    expect(onRemove).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();

    const main = screen.getByTestId("split-main");
    expect(main).toHaveAttribute("aria-haspopup", "menu");

    await userEvent.click(main);
    await userEvent.click(await screen.findByTestId("split-seven-days"));

    expect(onPick).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("gives both parts the brand, appearance and size it's given, as their own buttons", () => {
    const { container } = render(
      <SplitButton
        appearance="subdued"
        brand="neutral"
        action={remove()}
        size="sm"
        onClick={vi.fn()}
      >
        Date added
      </SplitButton>,
    );

    const parts = [...container.querySelectorAll(".nxm-button")];
    expect(parts).toHaveLength(2);
    parts.forEach((part) =>
      expect(part).toHaveClass("nxm-button-neutral", "nxm-button-subdued", "nxm-button-sm"),
    );
  });

  it("turns both parts off when disabled", () => {
    render(
      <SplitButton isDisabled action={remove()} data-testid="split-main" onClick={vi.fn()}>
        Date added
      </SplitButton>,
    );

    expect(screen.getByTestId("split-main")).toBeDisabled();
    expect(screen.getByTestId("split-remove")).toBeDisabled();
  });

  it("turns both parts off while loading", () => {
    render(
      <SplitButton isLoading action={remove()} data-testid="split-main" onClick={vi.fn()}>
        Date added
      </SplitButton>,
    );

    expect(screen.getByTestId("split-main")).toBeDisabled();
    expect(screen.getByTestId("split-remove")).toBeDisabled();
  });

  it("dims a static main part when disabled", () => {
    render(
      <SplitButton isDisabled action={remove()} data-testid="split-main">
        +2 more filter
      </SplitButton>,
    );

    expect(screen.getByTestId("split-main").closest(".nxm-button")).toHaveClass(
      "nxm-button-disabled",
    );
  });
});
