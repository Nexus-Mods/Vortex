import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IGameInfoEntry } from "@/types/IState";

import { GameDetailsModal } from "./GameDetailsModal";

const openUrl = vi.fn();
const openFile = vi.fn();

/** Flipped per test, then read by the component's own selectors through the mocked hook. */
const store = vi.hoisted(() => ({ gameInfo: {} as { [key: string]: unknown } }));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      settings: { gameMode: { discovered: {} }, interface: { language: "en" } },
      persistent: { gameMode: { gameInfo: { skyrimse: store.gameInfo } } },
    }),
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const entry = (value: string, type: string): IGameInfoEntry => ({
  key: "row",
  provider: "test",
  priority: 0,
  expires: Number.MAX_SAFE_INTEGER,
  title: "Row",
  value,
  type,
});

const renderModal = () =>
  render(<GameDetailsModal gameId="skyrimse" gameName="Skyrim" isOpen={true} onClose={vi.fn()} />);

describe("GameDetailsModal", () => {
  beforeEach(() => {
    openUrl.mockClear();
    openFile.mockClear();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl, openFile } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the game folder as a path", async () => {
    store.gameInfo = { path: entry("C:\\Games\\Skyrim", "path") };
    renderModal();

    await userEvent.click(screen.getByTestId("game-detail-link"));

    expect(openFile).toHaveBeenCalledWith("C:\\Games\\Skyrim");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("opens a web link in the browser", async () => {
    store.gameInfo = { site: entry("https://example.com/game", "url") };
    renderModal();

    await userEvent.click(screen.getByTestId("game-detail-link"));

    expect(openUrl).toHaveBeenCalledWith("https://example.com/game");
    expect(openFile).not.toHaveBeenCalled();
  });
});
