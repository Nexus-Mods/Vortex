import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setDialogVisible } from "@/actions";

const { dispatch, emit } = vi.hoisted(() => ({ dispatch: vi.fn(), emit: vi.fn() }));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({
    // `useGlobalIconActions` walks the extensions for `registerAction` calls;
    // nothing has registered any here, so the extension group comes out empty.
    apply: vi.fn(),
    getApi: () => ({ events: { emit }, showErrorNotification: vi.fn() }),
  }),
}));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (state: unknown) => unknown) => selector({}),
  };
});

import { HelpMenu } from "./HelpMenu";

const openMenu = async () => {
  render(<HelpMenu />);
  await userEvent.click(screen.getByRole("button", { name: "Help" }));
};

describe("HelpMenu", () => {
  beforeEach(() => {
    dispatch.mockClear();
    emit.mockClear();
  });

  it("lists the support bundle row among Vortex's own help rows", async () => {
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "View logs" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Create support bundle" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "About" })).toBeInTheDocument();
  });

  it("opens the support bundle dialog when its row is chosen", async () => {
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Create support bundle" }));

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible("support-bundle-dialog"));
  });

  it("tracks the support bundle request in Mixpanel", async () => {
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Create support bundle" }));

    expect(emit).toHaveBeenCalledWith(
      "analytics-track-mixpanel-event",
      expect.objectContaining({
        eventName: "app_support_bundle_clicked",
        properties: { source: "help_menu" },
      }),
    );
  });
});
