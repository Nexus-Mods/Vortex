import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TFunction } from "i18next";
import React from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IGameInfoEntry } from "@/types/IState";

import type { IGameStored } from "../types/IGameStored";
import GameInfoPopover from "./GameInfoPopover";

const openUrl = vi.fn();
const openFile = vi.fn();

const t = ((key: string) => key) as unknown as TFunction;
const game = { id: "skyrimse" } as IGameStored;

const entry = (key: string, value: string, type: string): IGameInfoEntry => ({
  key,
  provider: "test",
  priority: 0,
  expires: Number.MAX_SAFE_INTEGER,
  title: key,
  value,
  type,
});

/** Only what the popover reads: the game's info entries, its discovery and the language. */
const renderPopover = (gameInfo: { [key: string]: IGameInfoEntry }) => {
  const store = {
    getState: () => ({
      settings: { gameMode: { discovered: {} }, interface: { language: "en" } },
      persistent: { gameMode: { gameInfo: { [game.id]: gameInfo } } },
    }),
    subscribe: () => () => undefined,
    dispatch: vi.fn(),
  };

  render(
    <Provider store={store as never}>
      <GameInfoPopover t={t} game={game} onRefreshGameInfo={() => Promise.resolve()} />
    </Provider>,
  );
};

describe("GameInfoPopover", () => {
  beforeEach(() => {
    openUrl.mockClear();
    openFile.mockClear();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl, openFile } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The game folder has to reach main as a path, so it opens through a file:// URL there.
  it("opens the game folder as a path", async () => {
    renderPopover({ path: entry("path", "C:\\Games\\Skyrim", "path") });

    await userEvent.click(screen.getByTestId("game-info-path"));

    expect(openFile).toHaveBeenCalledWith("C:\\Games\\Skyrim");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("opens a web link in the browser", async () => {
    renderPopover({ site: entry("site", "https://example.com/game", "url") });

    await userEvent.click(screen.getByRole("link"));

    expect(openUrl).toHaveBeenCalledWith("https://example.com/game");
    expect(openFile).not.toHaveBeenCalled();
  });
});
