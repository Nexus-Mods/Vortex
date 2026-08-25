import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IMainPage } from "../types/IMainPage";

vi.mock("../contexts", () => ({ useMainContext: () => ({ api: {} }) }));

/** The gate renders its children straight through; the chrome around them is the subject. */
vi.mock("../controls/ExtensionGate", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MainPageContainer } from "./MainPageContainer";

// --- Helpers ---

const makePage = (options: Partial<IMainPage>): IMainPage =>
  ({
    id: "Mods",
    group: "per-game",
    component: () => <div data-testid="page-body" />,
    propsFunc: () => ({}),
    visible: () => true,
    ...options,
  }) as IMainPage;

/** The legacy chrome's outer wrapper, which a redesigned page renders without. */
const legacyChrome = () => document.querySelector(".main-page");

const renderPage = (options: Partial<IMainPage>) => {
  render(<MainPageContainer active page={makePage(options)} secondary={false} />);
};

// --- Tests ---

describe("MainPageContainer", () => {
  it("wraps a page that has no rendering of its own in the legacy chrome", () => {
    renderPage({});

    expect(legacyChrome()).toBeInTheDocument();
    expect(screen.getByTestId("page-body")).toBeInTheDocument();
  });

  it("leaves a redesigned page to render its own chrome", () => {
    renderPage({ newLayout: true });

    expect(legacyChrome()).not.toBeInTheDocument();
  });

  // What a page that has both renderings resolves to under the classic UI. The legacy
  // chrome is what its old rendering needs — its header portals into one of the wrappers.
  it("gives the legacy chrome to a page whose newLayout resolved false", () => {
    renderPage({ newLayout: false });

    expect(legacyChrome()).toBeInTheDocument();
  });

  // PagesContext resolves the callback form before it gets here. If one ever arrives
  // unresolved, the legacy chrome is the safe answer rather than a truthy function.
  it("does not mistake an unresolved callback for a yes", () => {
    renderPage({ newLayout: (() => true) as unknown as boolean });

    expect(legacyChrome()).toBeInTheDocument();
  });
});
