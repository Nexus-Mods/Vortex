import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Tooltip } from "@/ui/components/tooltip/Tooltip";

/** Stands in for a region of the layout, with one tooltip trigger in it. */
const { region } = vi.hoisted(() => ({
  // Rendered only after the imports below have resolved.
  region: (name: string) => () => (
    <Tooltip content={`${name} tip`} delay={0}>
      <button type="button">{name}</button>
    </Tooltip>
  ),
}));

vi.mock("../../hooks", () => ({ useSwitchingProfile: () => false }));
vi.mock("../components/Header/Header", () => ({ Header: region("header") }));
vi.mock("../components/Spine/Spine", () => ({ Spine: region("spine") }));
vi.mock("../components/Spine/SpineContext", () => ({
  SpineProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../components/ContentPane", () => ({ ModernContentPane: region("content") }));
vi.mock("../components/Menu/Menu", () => ({ Menu: () => null }));
vi.mock("./DialogLayer", () => ({ DialogLayer: () => null }));
vi.mock("./LayoutContainer", () => ({
  LayoutContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./ProfileSwitcher", () => ({ ProfileSwitcher: () => null }));
vi.mock("./ToastContainer", () => ({ ToastContainer: () => null }));
vi.mock("./UIBlocker", () => ({ UIBlocker: () => null }));

import { ModernLayout } from "./ModernLayout";

/** Hovers a region's trigger and returns whether its tooltip is in a chrome layer. */
const opensInChromeLayer = async (name: string) => {
  render(<ModernLayout />);
  await userEvent.hover(screen.getByRole("button", { name }));
  const tooltip = await screen.findByRole(
    "tooltip",
    { name: `${name} tip` },
    // Generous for a loaded CI runner; it resolves in milliseconds when the suite runs alone.
    { timeout: 5000 },
  );
  return tooltip.closest('[data-testid="chrome-overlays"]') !== null;
};

// The title bar and spine stay at 100% while the page zooms, so what they
// open has to render at 100% too. Content overlays zoom with the content.
describe("ModernLayout", () => {
  it("renders overlays from the title bar at the chrome's scale", async () => {
    expect(await opensInChromeLayer("header")).toBe(true);
  });

  it("renders overlays from the spine at the chrome's scale", async () => {
    expect(await opensInChromeLayer("spine")).toBe(true);
  });

  it("leaves overlays from the content at the page's scale", async () => {
    expect(await opensInChromeLayer("content")).toBe(false);
  });
});
