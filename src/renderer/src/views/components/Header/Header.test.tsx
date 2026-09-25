import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CHROME_ZOOM } from "@/ui/components/chrome_zoom/ChromeZoomScope";

vi.mock("@/contexts", () => ({
  useWindowContext: () => ({ menuIsCollapsed: false, setMenuIsCollapsed: vi.fn() }),
}));
vi.mock("../Spine/SpineContext", () => ({
  useSpineContext: () => ({ selection: { type: "home" } }),
}));
vi.mock("../../../util/selectors", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  activeProfile: () => undefined,
  gameProfiles: () => [],
  knownGames: () => [],
}));
vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { window: { zoomFactor: 1.2 } } }),
}));
vi.mock("./premium/PremiumIndicator", () => ({ PremiumIndicator: () => null }));
vi.mock("./profile/ProfileSection", () => ({ ProfileSection: () => null }));
vi.mock("./StagingIndicator", () => ({ StagingIndicator: () => null }));
vi.mock("./VersionIndicator", () => ({ VersionIndicator: () => null }));
vi.mock("./WindowControls", () => ({ WindowControls: () => null }));

import { Header } from "./Header";

describe("Header", () => {
  it("cancels the page zoom so the title bar stays at 100%", () => {
    render(<Header />);
    expect(screen.getByTestId("window-titlebar").style.zoom).toBe(CHROME_ZOOM);
  });
});
