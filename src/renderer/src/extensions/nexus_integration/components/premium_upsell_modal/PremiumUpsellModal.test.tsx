import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Content } from "@/util/util";

const mocks = vi.hoisted(() => ({ isPremium: false, openUrl: vi.fn(), refresh: vi.fn() }));

vi.mock("react-redux", () => ({
  useSelector: (selector: () => unknown) => selector(),
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ isPremium: () => mocks.isPremium }));
vi.mock("@/extensions/nexus_integration/hooks/useRefreshUserInfoOnFocus", () => ({
  useRefreshUserInfoOnFocus: mocks.refresh,
}));

import { PremiumUpsellModal, type IPremiumUpsellModalProps } from "./PremiumUpsellModal";

const api = {} as IExtensionApi;

const props = () => ({
  api,
  isOpen: true,
  title: "Skip the website",
  description: "It's a Premium feature.",
  fallbackLabel: "Via mod page (free)",
  content: Content.BrowseModsAd,
  onClose: vi.fn(),
  onFallback: vi.fn(),
  onShown: vi.fn(),
  onDismissed: vi.fn(),
  onUnlockClicked: vi.fn(),
  onPremiumUnlocked: vi.fn(),
});

const renderModal = (overrides: Partial<IPremiumUpsellModalProps> = {}) => {
  const p = { ...props(), ...overrides };
  const view = render(<PremiumUpsellModal {...p} />);
  return {
    p,
    rerender: (next: Partial<IPremiumUpsellModalProps>) =>
      view.rerender(<PremiumUpsellModal {...p} {...next} />),
  };
};

describe("PremiumUpsellModal", () => {
  beforeEach(() => {
    mocks.isPremium = false;
    mocks.openUrl.mockReset();
    window.api.shell = { openUrl: mocks.openUrl } as unknown as typeof window.api.shell;
    mocks.refresh.mockReset();
  });

  it("says what Premium skips, why, and what else it brings", () => {
    renderModal();

    expect(screen.getByText("Skip the website")).toBeInTheDocument();
    expect(screen.getByText("It's a Premium feature.")).toBeInTheDocument();
    expect(screen.getByText("premium_upsell::benefits::downloads")).toBeInTheDocument();
  });

  it("counts each opening once, however often it re-renders", () => {
    const { p, rerender } = renderModal();

    rerender({ onShown: p.onShown, title: "Still open" });
    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect(p.onShown).toHaveBeenCalledTimes(2);
  });

  it("watches for a purchase only while open", () => {
    renderModal({ isOpen: false });

    expect(mocks.refresh).toHaveBeenLastCalledWith(api, false);
  });

  it("takes the free way", async () => {
    const { p } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Via mod page (free)" }));

    expect(p.onFallback).toHaveBeenCalledTimes(1);
  });

  it("opens the Premium page for its campaign, staying open to see the purchase land", async () => {
    const { p } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: "premium_upsell::unlock" }));

    expect(p.onUnlockClicked).toHaveBeenCalledTimes(1);
    expect(mocks.openUrl).toHaveBeenCalledWith(expect.stringContaining("content=browse_mods_ad"));
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it("counts a dismissal, then closes", async () => {
    const { p } = renderModal();

    await userEvent.keyboard("{Escape}");

    expect(p.onDismissed).toHaveBeenCalledTimes(1);
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes and runs the gated action once when the user turns Premium", () => {
    const { p, rerender } = renderModal();

    mocks.isPremium = true;
    rerender({ title: "Still open" });
    rerender({ title: "Open still" });

    expect(p.onClose).toHaveBeenCalledTimes(1);
    expect(p.onPremiumUnlocked).toHaveBeenCalledTimes(1);
    expect(p.onDismissed).not.toHaveBeenCalled();
  });
});
