import { render } from "@testing-library/react";
import { VortexGameId } from "@vortex/shared";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The context values under test, set per case. */
const context = vi.hoisted(() => ({
  selection: { type: "game" } as { type: string },
  switchingProfile: false,
  activeGameId: "skyrimse",
  purges: {} as Record<string, IPurgeProgress>,
  sendNotification: vi.fn(),
  dismissNotification: vi.fn(),
}));

vi.mock("@/contexts", () => ({
  useMainContext: () => ({
    api: {
      sendNotification: context.sendNotification,
      dismissNotification: context.dismissNotification,
    },
  }),
}));

vi.mock("@/views/components/Spine/SpineContext", () => ({
  useSpineContext: () => ({ selection: context.selection }),
}));

vi.mock("@/hooks/useSwitchingProfile", () => ({
  useSwitchingProfile: () => context.switchingProfile,
}));

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      session: { base: { purges: context.purges } },
      settings: { profiles: { activeProfileId: "profile" } },
      persistent: { profiles: { profile: { id: "profile", gameId: context.activeGameId } } },
    }),
}));

import type { IPurgeProgress } from "@/types/IState";

import { PurgeNotifications } from "./PurgeNotifications";

const purging = (gameId: string, percent = 40): IPurgeProgress => ({
  gameId: VortexGameId(gameId),
  text: "Removing links",
  percent,
});

describe("PurgeNotifications", () => {
  beforeEach(() => {
    context.selection = { type: "game" };
    context.switchingProfile = false;
    context.activeGameId = "skyrimse";
    context.purges = {};
    context.sendNotification = vi.fn();
    context.dismissNotification = vi.fn();
  });

  it("leaves the active game's purge to the Apply button while the menu shows that game", () => {
    context.purges = { purge1: purging("skyrimse") };

    render(<PurgeNotifications />);

    expect(context.sendNotification).not.toHaveBeenCalled();
  });

  it("notifies about a purge started from a global page, where there's no Apply button", () => {
    context.selection = { type: "home" };
    context.purges = { purge1: purging("skyrimse") };

    render(<PurgeNotifications />);

    expect(context.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "purge1", type: "activity", progress: 40 }),
    );
  });

  it("notifies about another game's purge, which the Apply button doesn't show", () => {
    context.purges = { purge1: purging("fallout4") };

    render(<PurgeNotifications />);

    expect(context.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "purge1" }),
    );
  });

  it("notifies while the profile switcher hides the menu", () => {
    context.switchingProfile = true;
    context.purges = { purge1: purging("skyrimse") };

    render(<PurgeNotifications />);

    expect(context.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "purge1" }),
    );
  });

  it("keeps the notification up to date as the purge goes on", () => {
    context.selection = { type: "home" };
    context.purges = { purge1: purging("skyrimse", 10) };
    const { rerender } = render(<PurgeNotifications />);

    context.purges = { purge1: purging("skyrimse", 60) };
    rerender(<PurgeNotifications />);

    expect(context.sendNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "purge1", progress: 60 }),
    );
  });

  it("dismisses the notification once the purge finishes", () => {
    context.selection = { type: "home" };
    context.purges = { purge1: purging("skyrimse") };
    const { rerender } = render(<PurgeNotifications />);

    context.purges = {};
    rerender(<PurgeNotifications />);

    expect(context.dismissNotification).toHaveBeenCalledWith("purge1");
  });

  it("dismisses the notification once the user opens the game, where Apply shows it", () => {
    context.selection = { type: "home" };
    context.purges = { purge1: purging("skyrimse") };
    const { rerender } = render(<PurgeNotifications />);

    context.selection = { type: "game" };
    rerender(<PurgeNotifications />);

    expect(context.dismissNotification).toHaveBeenCalledWith("purge1");
  });
});
