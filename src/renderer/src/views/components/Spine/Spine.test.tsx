import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const spine = vi.hoisted(() => ({ selection: { type: "home" } }));

vi.mock("./SpineContext", () => ({
  useSpineContext: () => ({
    selection: spine.selection,
    selectGame: vi.fn(),
    selectGlobalPage: vi.fn(),
    selectHome: vi.fn(),
  }),
}));
vi.mock("../../../util/selectors", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  discovered: () => ({}),
  knownGames: () => [],
  profiles: () => ({}),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({}),
}));
vi.mock("./download_button/DownloadButton", () => ({ DownloadButton: () => null }));
vi.mock("./notifications/Notifications", () => ({ Notifications: () => null }));

import { Spine } from "./Spine";

describe("Spine", () => {
  it("does not cancel the page zoom, so the spine scales with the rest of the content", () => {
    render(<Spine />);
    expect(screen.getByTestId("spine").style.zoom).toBe("");
  });

  it("fills the home icon only while home is open", () => {
    const homeSymbol = () => screen.getByTestId("spine").querySelector('[data-symbol="home"]');

    spine.selection = { type: "home" };
    const { unmount } = render(<Spine />);
    expect(homeSymbol()).toHaveStyle({ fontVariationSettings: '"FILL" 1' });
    unmount();

    spine.selection = { type: "global-page" };
    render(<Spine />);
    expect(homeSymbol()).toHaveStyle({ fontVariationSettings: '"FILL" 0' });
  });
});
