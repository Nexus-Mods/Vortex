import { VortexModId } from "@vortex/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { focusModsTableMod } from "../../actions/session";
import { showModOnModsPage } from "./showModOnModsPage";

const SKYUI = VortexModId("skyui");

const apiWith = (betaTable: boolean, useModernLayout?: boolean) => {
  const api = {
    getState: () => ({ settings: { mods: { betaTable }, window: { useModernLayout } } }),
    store: { dispatch: vi.fn() },
    events: { emit: vi.fn() },
    highlightControl: vi.fn(),
  };

  return { api, show: () => showModOnModsPage(api as unknown as IExtensionApi, SKYUI) };
};

describe("showModOnModsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the new table to show the mod", () => {
    const { api, show } = apiWith(true);

    show();

    expect(api.store.dispatch).toHaveBeenCalledWith(focusModsTableMod(SKYUI));
    expect(api.events.emit).toHaveBeenCalledWith("show-main-page", "Mods");
  });

  it.each([
    ["the classic table", false, true],
    ["the classic layout", true, false],
  ])("scrolls %s to the mod's row once it's mounted, and highlights it", (_, beta, modern) => {
    const { api, show } = apiWith(beta, modern);

    show();

    expect(api.store.dispatch).not.toHaveBeenCalled();
    expect(api.events.emit).toHaveBeenCalledWith("show-main-page", "Mods");

    vi.runAllTimers();

    expect(api.events.emit).toHaveBeenCalledWith("mods-scroll-to", SKYUI);
    expect(api.highlightControl).toHaveBeenCalledWith(".skyui", 5000);
  });
});
