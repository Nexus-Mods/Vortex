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
  confidential: { account: { nexus: { APIKey: "an-api-key" } } },
  persistent: {
    nexus: { userInfo: { userId: 42, name: "Ada", profileUrl: "https://example.test/ada.png" } },
  },
});

const signedOut = () => ({
  confidential: { account: {} },
  persistent: {},
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

    it("groups the rows as it did before", async () => {
      await openMenu(/ada/i);
      expect(screen.getAllByRole("separator")).toHaveLength(2);
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
});
