import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, afterEach } from "vitest";

import { Popover } from "./Popover";
import { PopoverButton } from "./PopoverButton";
import { PopoverPanel } from "./PopoverPanel";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const renderComponent = () => {
  render(
    <Popover>
      <PopoverButton>Options</PopoverButton>

      <PopoverPanel>
        <button type="button">Inner action</button>
      </PopoverPanel>
    </Popover>,
  );

  return { trigger: screen.getByRole("button", { name: "Options" }) };
};

// --- Tests ---

describe("Popover", () => {
  it("applies the nxm-popover class to the wrapper", () => {
    renderComponent();
    expect(document.querySelector(".nxm-popover")).toBeInTheDocument();
  });

  it("renders the trigger button", () => {
    const { trigger } = renderComponent();
    expect(trigger).toBeInTheDocument();
  });

  it("does not show the panel until opened", () => {
    renderComponent();
    expect(screen.queryByText("Inner action")).not.toBeInTheDocument();
  });

  it("reveals the panel content when the trigger is clicked", async () => {
    const { trigger } = renderComponent();
    await userEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Inner action" })).toBeInTheDocument();
  });

  it("applies the nxm-popover-panel class to the panel when open", async () => {
    const { trigger } = renderComponent();
    await userEvent.click(trigger);
    expect(document.querySelector(".nxm-popover-panel")).toBeInTheDocument();
  });

  it("stays open when interacting with content inside the panel", async () => {
    const { trigger } = renderComponent();
    await userEvent.click(trigger);
    // Clicking non-dismissing content must not close the panel (unlike a Dropdown menu item).
    await userEvent.click(screen.getByRole("button", { name: "Inner action" }));
    expect(screen.getByRole("button", { name: "Inner action" })).toBeInTheDocument();
  });
});
