import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CHROME_ZOOM } from "@/ui/components/chrome_zoom/ChromeZoomScope";

vi.mock("./SpineContext", () => ({
  useSpineContext: () => ({
    selection: { type: "home" },
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
  it("cancels the page zoom so the spine stays at 100%", () => {
    render(<Spine />);
    expect(screen.getByTestId("spine").style.zoom).toBe(CHROME_ZOOM);
  });
});
