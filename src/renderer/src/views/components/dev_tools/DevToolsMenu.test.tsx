import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), useModernLayout: true }));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { window: { useModernLayout: mocks.useModernLayout } } }),
}));

vi.mock("./QueryDevtools", () => ({
  QueryDevtools: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Close query devtools
    </button>
  ),
}));

import { setUseModernLayout } from "@/actions/window";
import { getTheme } from "@/util/theme";

import { GameArtProvider } from "../game_art/GameArt.context";
import { DevToolsMenu } from "./DevToolsMenu";

const open = async () => {
  render(
    <GameArtProvider>
      <DevToolsMenu />
    </GameArtProvider>,
  );
  await userEvent.click(screen.getByTestId("dev-tools-trigger"));
};

describe("DevToolsMenu", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    mocks.dispatch = vi.fn();
    mocks.useModernLayout = true;
  });

  it("switches the layout", async () => {
    await open();

    await userEvent.click(screen.getByTestId("dev-tools-modern-layout"));

    expect(mocks.dispatch).toHaveBeenCalledWith(setUseModernLayout(false));
  });

  it("switches the light theme", async () => {
    await open();

    await userEvent.click(screen.getByTestId("dev-tools-light-theme"));

    expect(getTheme()).toBe("light");
    expect(screen.getByTestId("dev-tools-light-theme")).toHaveAttribute("aria-checked", "true");
  });

  it("turns the game art on, from off", async () => {
    await open();
    const gameArt = screen.getByTestId("dev-tools-game-art");
    expect(gameArt).toHaveAttribute("aria-checked", "false");

    await userEvent.click(gameArt);

    expect(gameArt).toHaveAttribute("aria-checked", "true");
  });

  it("opens the query devtools, and closes them from their own close button", async () => {
    await open();
    const queryDevtools = screen.getByTestId("dev-tools-query-devtools");

    await userEvent.click(queryDevtools);

    expect(queryDevtools).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByText("Close query devtools"));

    expect(screen.queryByText("Close query devtools")).toBeNull();

    await userEvent.click(screen.getByTestId("dev-tools-trigger"));

    expect(screen.getByTestId("dev-tools-query-devtools")).toHaveAttribute("aria-checked", "false");
  });
});
