import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setDialogVisible } from "@/actions";

const { dispatch, emit, isLoggedIn, openFeedbackDialog } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  emit: vi.fn(),
  isLoggedIn: vi.fn(),
  openFeedbackDialog: vi.fn(),
}));

vi.mock("@/extensions/nexus_integration/selectors", () => ({ isLoggedIn }));
vi.mock("@/extensions/support_bundle/util/openFeedbackDialog", () => ({ openFeedbackDialog }));

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
    isLoggedIn.mockReset().mockReturnValue(false);
    openFeedbackDialog.mockReset().mockImplementation((show: () => void) => {
      show();
      return Promise.resolve();
    });
  });

  it("offers a logged-in user one feedback row among Vortex's own help rows", async () => {
    isLoggedIn.mockReturnValue(true);
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "View logs" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Send feedback" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Create support bundle" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "About" })).toBeInTheDocument();
  });

  it("offers a logged-out user the support bundle by name, since they can't send feedback", async () => {
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Create support bundle" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Send feedback" })).not.toBeInTheDocument();
  });

  it("takes a logged-out user straight to the support bundle dialog", async () => {
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Create support bundle" }));

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible("support-bundle-dialog"));
    expect(openFeedbackDialog).not.toHaveBeenCalled();
  });

  it("opens the feedback dialog, with its choice, for a logged-in user", async () => {
    isLoggedIn.mockReturnValue(true);
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Send feedback" }));

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible("feedback-dialog"));
    expect(dispatch).not.toHaveBeenCalledWith(setDialogVisible("support-bundle-dialog"));
    expect(emit).not.toHaveBeenCalledWith("analytics-track-mixpanel-event", expect.anything());
  });

  it("tracks a logged-out user's support bundle request in Mixpanel", async () => {
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
