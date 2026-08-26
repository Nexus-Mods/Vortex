import { mdiTune, mdiViewGrid, mdiViewList } from "@mdi/js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";

import { ToolbarPanelButton } from "./ToolbarPanelButton";

// --- Helpers ---

/** The display options panel, whose "Display as" row holds a nested picker. */
const displayOptions = () => (
  <PopoverPanelGroup>
    <PopoverPanelGroupItem label="Display as">
      <Picker<string>
        button={{ leftIconPath: mdiViewGrid, size: "sm" }}
        options={[
          { label: "Grid", value: "small", iconPath: mdiViewGrid },
          { label: "List", value: "list", iconPath: mdiViewList },
        ]}
        value="small"
        onChange={() => {}}
      />
    </PopoverPanelGroupItem>
  </PopoverPanelGroup>
);

const openPanel = async () => {
  render(
    <ToolbarPanelButton label="Display options" leftIconPath={mdiTune} panel={displayOptions} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Display options" }));
  await waitFor(() => expect(screen.getByText("Display as")).toBeInTheDocument());
};

const panelRow = () => screen.queryByText("Display as");

/** The picker's own trigger, which sits inside the panel and shows the selection. */
const picker = () => screen.getByRole("button", { name: /Grid/ });

// --- Tests ---

describe("ToolbarPanelButton", () => {
  it("opens its panel", async () => {
    await openPanel();

    expect(panelRow()).toBeInTheDocument();
  });

  // The panel used to close on any focus leaving it, which is what a nested control
  // opening its own floating list looks like.
  it("stays open when a control inside it opens its own list", async () => {
    await openPanel();

    await userEvent.click(picker());

    expect(panelRow()).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("option", { name: /List/ })).toBeInTheDocument());
  });

  it("takes focus as it opens, so the keyboard lands in the panel", async () => {
    await openPanel();

    await waitFor(() =>
      expect(document.activeElement).toHaveClass("nxm-popover-panel-controls", { exact: false }),
    );
  });

  it("still closes on Escape", async () => {
    await openPanel();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(panelRow()).not.toBeInTheDocument());
  });
});
