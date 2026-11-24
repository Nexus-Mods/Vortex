import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  showGameArt: true,
  pages: [] as Array<{ id: string; isTranslucent?: boolean }>,
  mainPage: "browse",
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { interface: { showGameArt: mocks.showGameArt } } }),
}));
vi.mock("@/contexts", () => ({ usePagesContext: () => ({ mainPages: mocks.pages }) }));
vi.mock("@/hooks", () => ({
  usePageRendering: () => ({ mainPage: mocks.mainPage, renderPage: () => null }),
}));
vi.mock("../../DNDContainer", () => ({
  DNDContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ModernContentPane } from "./ContentPane";

const renderPane = (page: { isTranslucent?: boolean }) => {
  mocks.pages = [{ id: "browse", ...page }];
  render(<ModernContentPane />);
  return screen.getByTestId("content-pane");
};

describe("ModernContentPane", () => {
  beforeEach(() => {
    mocks.showGameArt = true;
  });

  it("lets the game art through behind a translucent page", () => {
    expect(renderPane({ isTranslucent: true })).toHaveClass("bg-surface-translucent-low");
  });

  it("is opaque behind a translucent page while the game art is turned off", () => {
    mocks.showGameArt = false;

    expect(renderPane({ isTranslucent: true })).toHaveClass("bg-surface-low");
  });

  it("is opaque behind a page that isn't translucent", () => {
    expect(renderPane({})).toHaveClass("bg-surface-low");
  });
});
