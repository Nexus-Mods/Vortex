import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { Switch } from "@/ui/components/form/switch/Switch";
import { Picker } from "@/ui/components/picker/Picker";

import { PopoverPanelGroupItem } from "./PopoverPanelGroupItem";

describe("PopoverPanelGroupItem", () => {
  it("names a switch with its label, and toggles it when the label is clicked", async () => {
    const onChange = vi.fn();
    render(
      <PopoverPanelGroupItem label="Show hidden items">
        <Switch checked={false} onChange={onChange} />
      </PopoverPanelGroupItem>,
    );

    await userEvent.click(screen.getByText("Show hidden items"));

    expect(screen.getByRole("checkbox", { name: "Show hidden items" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("names a picker with a passive label, which doesn't take clicks", async () => {
    render(
      <PopoverPanelGroupItem passive label="Display as">
        <Picker
          options={[
            { label: "Grid", value: "grid" },
            { label: "List", value: "list" },
          ]}
          value="grid"
          onChange={() => undefined}
        />
      </PopoverPanelGroupItem>,
    );

    const picker = screen.getByRole("button", { name: /Display as/ });
    await userEvent.click(screen.getByText("Display as"));

    expect(picker).not.toHaveFocus();
    expect(screen.getByText("Display as")).not.toHaveAttribute("for");
  });

  it("is a plain row with no label", () => {
    render(
      <PopoverPanelGroupItem className="justify-end">
        <button type="button">Reset</button>
      </PopoverPanelGroupItem>,
    );

    const row = screen.getByRole("button", { name: "Reset" }).parentElement;
    expect(row?.tagName).toBe("DIV");
    expect(row).toHaveClass("nxm-popover-panel-group-item", "justify-end");
    expect(document.querySelector("label")).toBeNull();
  });
});
