import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dispatch, emit, opn } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  emit: vi.fn(),
  opn: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({
    getApi: () => ({ events: { emit }, showErrorNotification: vi.fn() }),
  }),
}));

vi.mock("../../../../util/opn", () => ({ default: opn }));

/** Flipped per test, then read by the real selectors through the mocked hook. */
const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

const signedOut = () => ({ confidential: { account: {} }, persistent: {} });

const signedIn = (userInfo: Record<string, unknown>) => ({
  confidential: { account: { nexus: { APIKey: "an-api-key" } } },
  persistent: { nexus: { userInfo } },
});

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (state: unknown) => unknown) => selector(store.state),
  };
});

import { PremiumIndicator } from "./PremiumIndicator";

// --- Tests ---

describe("PremiumIndicator", () => {
  beforeEach(() => {
    dispatch.mockClear();
    emit.mockClear();
    opn.mockClear();
  });

  // Signed out there is nothing to say about the user's plan, so the slot carries
  // the call to action that gets them one — this is the only login affordance in
  // the header now that the profile slot holds the help menu instead.
  describe("signed out", () => {
    beforeEach(() => {
      store.state = signedOut();
    });

    it("offers a log in button", () => {
      render(<PremiumIndicator />);
      expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    });

    it("says nothing about premium", () => {
      render(<PremiumIndicator />);

      expect(screen.queryByText("Premium")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Go premium" })).not.toBeInTheDocument();
    });

    it("starts the login flow when pressed", async () => {
      render(<PremiumIndicator />);
      await userEvent.click(screen.getByRole("button", { name: "Log in" }));

      expect(dispatch).toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith("request-nexus-login", expect.any(Function));
    });
  });

  describe("signed in", () => {
    it("labels a premium user", () => {
      store.state = signedIn({ isPremium: true });
      render(<PremiumIndicator />);

      expect(screen.getByTestId("premium-indicator")).toHaveTextContent("Premium");
      expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
    });

    it("advertises premium to a free user", () => {
      store.state = signedIn({ isPremium: false, isSupporter: false });
      render(<PremiumIndicator />);

      expect(screen.getByRole("button", { name: "Go premium" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
    });

    it("stays quiet for a supporter", () => {
      store.state = signedIn({ isPremium: false, isSupporter: true });
      const { container } = render(<PremiumIndicator />);

      expect(container).toBeEmptyDOMElement();
    });
  });
});
