import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setOpenMainPage } from "@/actions/session";

const { dispatch, store } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  store: { gameName: undefined as string | undefined },
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (state: unknown) => unknown) =>
      selector({
        settings: { interface: { alwaysCompactHeaders: false } },
        session: { base: {} },
      }),
  };
});

vi.mock("@/extensions/gamemode_management/selectors", () => ({
  currentGame: () => (store.gameName ? { id: "game", name: store.gameName } : undefined),
}));

// The shared mock `t` hands back the key untouched; the subtitle needs `replace` applied.
vi.mock("react-i18next", () => {
  const t = (key: string, options?: { replace?: Record<string, string> }) =>
    Object.entries(options?.replace ?? {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, value),
      key,
    );

  return { useTranslation: () => Object.assign([t], { t }) };
});

// The legacy icon set it draws from needs the app's icon files, which tests don't have.
vi.mock("@/controls/EmptyPlaceholder", () => ({ default: () => null }));

vi.mock("@/ExtensionProvider", () => ({ useExtensionObjects: () => [] }));

import { GameSettings } from "./GameSettings";

describe("GameSettings header", () => {
  beforeEach(() => {
    dispatch.mockClear();
    store.gameName = undefined;
  });

  it("opens the Vortex settings page from the header button", async () => {
    render(<GameSettings />);
    await userEvent.click(screen.getByRole("button", { name: "Vortex settings" }));

    expect(dispatch).toHaveBeenCalledWith(setOpenMainPage("application_settings", false));
  });

  it("names the active game in the subtitle", () => {
    store.gameName = "  Stardew   Valley ";
    render(<GameSettings />);

    expect(screen.getByText("Settings for Stardew Valley.")).toBeInTheDocument();
  });

  it("falls back to a generic subtitle without an active game", () => {
    render(<GameSettings />);

    expect(screen.getByText("Settings specific to the game you are managing.")).toBeInTheDocument();
  });
});
