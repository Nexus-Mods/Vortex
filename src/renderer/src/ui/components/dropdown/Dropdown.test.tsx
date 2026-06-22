import { Menu } from "@headlessui/react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Dropdown } from "./Dropdown";
import { DropdownDivider } from "./DropdownDivider";
import { DropdownItem } from "./DropdownItem";
import { DropdownItems } from "./DropdownItems";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = () => {
  const onEdit = vi.fn();

  render(
    <Dropdown>
      <Menu.Button>Options</Menu.Button>

      <DropdownItems>
        <DropdownItem onClick={onEdit}>Edit</DropdownItem>

        <DropdownItem disabled={true}>Disabled</DropdownItem>

        <DropdownDivider />

        <DropdownItem onClick={() => undefined}>Delete</DropdownItem>
      </DropdownItems>
    </Dropdown>,
  );

  return { onEdit, trigger: screen.getByRole("button", { name: "Options" }) };
};

// --- Tests ---

describe("Dropdown", () => {
  it("applies the nxm-dropdown class to the wrapper", () => {
    renderComponent();
    expect(document.querySelector(".nxm-dropdown")).toBeInTheDocument();
  });

  it("renders the trigger button", () => {
    const { trigger } = renderComponent();
    expect(trigger).toBeInTheDocument();
  });

  it("does not show the menu items until opened", () => {
    renderComponent();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("reveals the menu items when the trigger is clicked", async () => {
    const { trigger } = renderComponent();
    await userEvent.click(trigger);
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders a divider as a separator when open", async () => {
    const { trigger } = renderComponent();
    await userEvent.click(trigger);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("calls the item's onClick when selected", async () => {
    const { onEdit, trigger } = renderComponent();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("disables a disabled item", async () => {
    const { trigger } = renderComponent();
    await userEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Disabled" })).toBeDisabled();
  });
});
