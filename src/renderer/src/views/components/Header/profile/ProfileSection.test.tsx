import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({
    // `useGlobalIconActions` walks the extensions for `registerAction` calls;
    // nothing has registered any here, so the extension group comes out empty.
    apply: vi.fn(),
    getApi: () => ({ events: { emit }, showErrorNotification: vi.fn() }),
  }),
}));

vi.mock("../../../../util/opn", () => ({ default: vi.fn(() => Promise.resolve()) }));

/** Flipped per test, then read by the real selectors through the mocked hook. */
const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

const signedIn = () => ({
  settings: { window: { zoomFactor: 1 } },
  confidential: { account: { nexus: { APIKey: "an-api-key" } } },
  persistent: {
    nexus: { userInfo: { userId: 42, name: "Ada", profileUrl: "https://example.test/ada.png" } },
  },
});

const signedOut = () => ({
  confidential: { account: {} },
  persistent: {},
});

/** Credentials in hand but no account details — what an offline start leaves behind. */
const unvalidated = () => ({
  settings: { window: { zoomFactor: 1 } },
  confidential: { account: { nexus: { APIKey: "an-api-key" } } },
  persistent: { nexus: {} },
});

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => vi.fn(),
    useSelector: (selector: (state: unknown) => unknown) => selector(store.state),
  };
});

import { ProfileSection } from "./ProfileSection";

// --- Helpers ---

const openMenu = async (name: RegExp) => {
  render(<ProfileSection />);
  const trigger = screen.getByRole("button", { name });
  await userEvent.click(trigger);

  return trigger;
};

// --- Tests ---

describe("ProfileSection", () => {
  beforeEach(() => {
    emit.mockClear();
  });

  describe("signed in", () => {
    beforeEach(() => {
      store.state = signedIn();
    });

    it("names the trigger after the user", () => {
      render(<ProfileSection />);
      expect(screen.getByRole("button", { name: "Ada" })).toBeInTheDocument();
    });

    it("renders the avatar, which the e2e suite locates by its alt text", () => {
      render(<ProfileSection />);
      expect(screen.getByAltText("Ada")).toBeInTheDocument();
    });

    it("opens the account menu with the help row in place of send feedback", async () => {
      await openMenu(/ada/i);

      expect(screen.getByRole("menuitem", { name: "View profile on web" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Refresh user info" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Help" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /send feedback/i })).not.toBeInTheDocument();
    });

    it("separates zoom from the profile link and remaining actions", async () => {
      await openMenu(/ada/i);
      expect(screen.getAllByRole("separator")).toHaveLength(3);
      expect(screen.getByRole("group", { name: "Zoom" })).toBeInTheDocument();
      expect(screen.getByTestId("profile-zoom-percent")).toHaveTextContent("100%");
    });

    it("lets the keyboard reach zoom controls and continue through the menu", async () => {
      const trigger = await openMenu(/ada/i);
      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("group", { name: "Zoom" })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole("menuitem", { name: "Zoom out" })).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      expect(screen.getByRole("menu")).toBeInTheDocument();
      await userEvent.tab();
      expect(screen.getByRole("menuitem", { name: "Zoom in" })).toHaveFocus();
      await userEvent.keyboard("{ArrowDown}");
      expect(screen.getByRole("menuitem", { name: "Refresh user info" })).toHaveFocus();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it("opens the help options beside the account menu, leaving it open", async () => {
      await openMenu(/ada/i);
      await userEvent.click(screen.getByRole("menuitem", { name: "Help" }));

      expect(screen.getByRole("menuitem", { name: "Help centre" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "View logs" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "About" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
    });

    it("puts both menus away once a help destination is chosen", async () => {
      await openMenu(/ada/i);
      await userEvent.click(screen.getByRole("menuitem", { name: "Help" }));
      await userEvent.click(screen.getByRole("menuitem", { name: "About" }));

      expect(emit).toHaveBeenCalledWith("show-main-page", "About");
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    });
  });

  describe("signed out", () => {
    beforeEach(() => {
      store.state = signedOut();
    });

    it("replaces the avatar with a help button", () => {
      render(<ProfileSection />);

      expect(screen.getByRole("button", { name: "Help" })).toBeInTheDocument();
      expect(screen.queryByAltText("Ada")).not.toBeInTheDocument();
    });

    // Nothing to nest inside without an account menu, so the help rows are the menu.
    it("opens the help options flat, with no nesting", async () => {
      await openMenu(/help/i);

      expect(screen.getByRole("menuitem", { name: "Help centre" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "View logs" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "About" })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Help" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("menu")).toHaveLength(1);
    });

    it("offers no account rows", async () => {
      await openMenu(/help/i);

      expect(screen.queryByRole("menuitem", { name: /profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /logout/i })).not.toBeInTheDocument();
    });
  });

  // The credentials say signed in, so the premium slot won't offer a login button. Logging out
  // here is the only way back to one, so the menu has to open on a generic account.
  describe("signed in but not validated", () => {
    beforeEach(() => {
      store.state = unvalidated();
    });

    it("names the trigger generically", () => {
      render(<ProfileSection />);
      expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
    });

    it("still offers a way out", async () => {
      await openMenu(/account/i);

      expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Refresh user info" })).toBeInTheDocument();
    });

    // There is no user id to open a profile for, and dropping the row must not leave the
    // divider that separated it behind.
    it("drops the profile row and its divider", async () => {
      await openMenu(/account/i);

      expect(
        screen.queryByRole("menuitem", { name: "View profile on web" }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole("separator")).toHaveLength(2);
    });
  });
});
