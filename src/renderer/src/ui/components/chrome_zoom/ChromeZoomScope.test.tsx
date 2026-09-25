import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { CHROME_ZOOM, ChromeZoomScope } from "./ChromeZoomScope";

const layer = () => screen.getByTestId("chrome-overlays");

describe("ChromeZoomScope", () => {
  it("renders a window-sized layer that cancels the page zoom", () => {
    render(<ChromeZoomScope>chrome</ChromeZoomScope>);
    expect(layer().style.zoom).toBe(CHROME_ZOOM);
    expect(layer()).toHaveClass("absolute", "inset-0", "pointer-events-none");
    expect(layer().parentElement).toBe(document.body);
  });

  it("puts tooltips opened from the chrome in that layer, and others outside it", async () => {
    render(
      <>
        <ChromeZoomScope>
          <Tooltip content="inside" delay={0}>
            <button type="button">chrome</button>
          </Tooltip>
        </ChromeZoomScope>

        <Tooltip content="outside" delay={0}>
          <button type="button">page</button>
        </Tooltip>
      </>,
    );
    await userEvent.hover(screen.getByRole("button", { name: "chrome" }));
    expect(layer()).toContainElement(await screen.findByRole("tooltip"));
    await userEvent.unhover(screen.getByRole("button", { name: "chrome" }));
    await userEvent.hover(screen.getByRole("button", { name: "page" }));
    expect(layer()).not.toContainElement(await screen.findByRole("tooltip", { name: "outside" }));
  });

  it("puts anchored popovers opened from the chrome in that layer", async () => {
    render(
      <ChromeZoomScope>
        <Popover>
          <PopoverButton>open</PopoverButton>

          <PopoverPanel data-testid="panel">content</PopoverPanel>
        </Popover>
      </ChromeZoomScope>,
    );
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(layer()).toContainElement(await screen.findByTestId("panel"));
  });

  // The account menu's Help submenu: a panel opened from inside another panel.
  it("keeps a submenu opened from a chrome popover in that layer", async () => {
    render(
      <ChromeZoomScope>
        <Popover>
          <PopoverButton>open</PopoverButton>

          <PopoverPanel>
            <Popover>
              <PopoverButton>more</PopoverButton>

              <PopoverPanel data-testid="submenu">content</PopoverPanel>
            </Popover>
          </PopoverPanel>
        </Popover>
      </ChromeZoomScope>,
    );
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    await userEvent.click(await screen.findByRole("button", { name: "more" }));
    expect(layer()).toContainElement(await screen.findByTestId("submenu"));
  });
});
