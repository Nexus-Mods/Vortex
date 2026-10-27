import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  game: undefined as { name: string } | undefined,
  tierZero: false,
  isModsEnabled: true,
  gameId: "skyrimse",
  collectionsMounts: 0,
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { interface: { alwaysCompactHeaders: false } } }),
}));

vi.mock("../../../gamemode_management/selectors", () => ({
  currentGame: () => mocks.game,
}));

vi.mock("@/util/selectors", () => ({
  activeGameId: () => mocks.gameId,
}));

vi.mock("@/contexts/FlagsContext", () => ({
  useFlag: (name: string) => (mocks.isModsEnabled ? { name } : undefined),
}));

vi.mock("@/extensions/gamemode_management/tiered/tierZero", () => ({
  isTierZeroManagedGame: () => mocks.tierZero,
}));

// Fills in `{{…}}`, which the shared stub leaves alone, so the subtitle shows the game's name.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => {
    const t = (key: string, options?: Record<string, string>) =>
      key.replace(/{{(\w+)}}/g, (_, name: string) => options?.[name] ?? "");
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
}));

vi.mock("../../hooks/use_collection_search/useCollectionSearch.hook", () => ({
  useCollectionSearch: () => ({ allCollectionsTotal: 126 }),
}));

vi.mock("../../hooks/use_mod_search/useModSearch.hook", () => ({
  useModSearch: () => ({ allModsTotal: 1480 }),
}));

vi.mock("../../components/browse_collections/BrowseCollections", () => ({
  BrowseCollections: () => {
    React.useEffect(() => {
      mocks.collectionsMounts += 1;
    }, []);
    return <div>Collections panel</div>;
  },
}));

vi.mock("../../components/browse_mods/BrowseMods", () => ({
  BrowseMods: () => <div>Mods panel</div>,
}));

vi.mock("../../components/mods_coming_soon/ModsComingSoon", () => ({
  ModsComingSoon: () => <div>Mods coming soon</div>,
}));

import type { IExtensionApi } from "@/types/IExtensionContext";

import { BrowsePage } from "./BrowsePage";

const api = {} as IExtensionApi;

describe("BrowsePage", () => {
  beforeEach(() => {
    mocks.game = { name: "Skyrim Special Edition" };
    mocks.tierZero = false;
    mocks.isModsEnabled = true;
    mocks.gameId = "skyrimse";
    mocks.collectionsMounts = 0;
  });

  it("names the page and the game it browses", () => {
    render(<BrowsePage active api={api} />);

    expect(screen.getByText("Browse")).toBeTruthy();
    expect(screen.getByText("Discover and install mods for Skyrim Special Edition.")).toBeTruthy();
  });

  it("heads the page with the Nexus Mods pictogram", () => {
    const { container } = render(<BrowsePage active api={api} />);

    expect(container.querySelector('use[href="assets/pictograms/nexus-mods.svg"]')).toBeTruthy();
  });

  it("drops the game from the subtitle when there isn't one", () => {
    mocks.game = undefined;

    render(<BrowsePage active api={api} />);

    expect(screen.getByText("Discover and install mods.")).toBeTruthy();
  });

  it("switches between mods and collections from the header, with their counts", () => {
    render(<BrowsePage active api={api} />);

    expect(screen.getByRole("tab", { name: /Mods.*1,480/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Collections.*126/ })).toBeTruthy();
    expect(screen.getByText("Mods panel")).toBeTruthy();
    expect(screen.queryByText("Collections panel")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Collections/ }));

    expect(screen.getByText("Collections panel")).toBeTruthy();
    expect(screen.queryByText("Mods panel")).toBeNull();
  });

  it("has no collections tab for a game managed without an extension", () => {
    mocks.tierZero = true;

    render(<BrowsePage active api={api} />);

    expect(screen.queryByRole("tab", { name: /Collections/ })).toBeNull();
    expect(screen.getByText("Mods panel")).toBeTruthy();
  });

  it("says mods are coming soon, with no count, while browsing mods is flagged off", () => {
    mocks.isModsEnabled = false;

    render(<BrowsePage active api={api} />);

    fireEvent.click(screen.getByRole("tab", { name: "Mods" }));

    expect(screen.getByText("Mods coming soon")).toBeTruthy();
    expect(screen.queryByText("Mods panel")).toBeNull();
  });

  it("opens on the collections while browsing mods is flagged off", () => {
    mocks.isModsEnabled = false;

    render(<BrowsePage active api={api} />);

    expect(screen.getByText("Collections panel")).toBeTruthy();
  });

  it("opens on the mods while browsing mods is flagged off, for a game with no collections tab", () => {
    mocks.isModsEnabled = false;
    mocks.tierZero = true;

    render(<BrowsePage active api={api} />);

    expect(screen.getByText("Mods coming soon")).toBeTruthy();
  });

  it("keeps the tab picked when the game changes, starting what's under it over", () => {
    const { rerender } = render(<BrowsePage active api={api} />);
    fireEvent.click(screen.getByRole("tab", { name: /Collections/ }));

    mocks.gameId = "fallout4";
    rerender(<BrowsePage active api={api} />);

    expect(screen.getByText("Collections panel")).toBeTruthy();
    expect(mocks.collectionsMounts).toBe(2);
  });
});
