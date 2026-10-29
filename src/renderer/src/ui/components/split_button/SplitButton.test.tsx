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
  <SplitButtonAction icon="close" label="Remove filter" onClick={onClick} />
);

describe("SplitButton", () => {
  it("shows a main part without a click handler as it is, but not as a button", () => {
    render(<SplitButton action={remove()}>+2 more filter</SplitButton>);

    expect(screen.getByText("+2 more filter")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+2 more filter" })).toBeNull();
    expect(screen.getByText("+2 more filter").closest(".nxm-button")).not.toHaveClass(
      "nxm-button-disabled",
    );
  });

  it("makes the main part a button with a click handler", async () => {
    const onClick = vi.fn();
    render(
      <SplitButton action={remove()} onClick={onClick}>
        Date added
      </SplitButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Date added" }));

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

    await userEvent.click(screen.getByRole("button", { name: "Remove filter" }));

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
              icon="keyboard_arrow_down"
              label="More options"
            />

            <PopoverPanel>
              {({ close }) => (
                <PopoverMenu
                  actions={[[{ label: "Rename", onClick: onRename }]]}
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

    await userEvent.click(screen.getByRole("button", { name: "More options" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));

    expect(onRename).toHaveBeenCalled();
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
      <SplitButton isDisabled action={remove()} onClick={vi.fn()}>
        Date added
      </SplitButton>,
    );

    expect(screen.getByRole("button", { name: "Date added" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove filter" })).toBeDisabled();
  });

  it("dims a static main part when disabled", () => {
    render(
      <SplitButton isDisabled action={remove()}>
        +2 more filter
      </SplitButton>,
    );

    expect(screen.getByText("+2 more filter").closest(".nxm-button")).toHaveClass(
      "nxm-button-disabled",
    );
  });
});
