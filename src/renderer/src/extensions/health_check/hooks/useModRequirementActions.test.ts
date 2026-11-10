import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IModRequirementExt } from "../types";
import type { IssueAnalyticsIdentity } from "../utils/shared/tracking";
import { useModRequirementActions } from "./useModRequirementActions";

// No feedback given yet; the premium ad flag doesn't touch the page-opening actions.
vi.mock("react-redux", () => ({ useSelector: () => ({}) }));

const openUrl = vi.fn();

const api = {} as IExtensionApi;
const identity = {} as IssueAnalyticsIdentity;

const requirement = (overrides: Partial<IModRequirementExt> = {}) =>
  ({
    id: "req-1",
    modId: 100,
    gameId: "skyrimspecialedition",
    modUrl: "https://www.nexusmods.com/skyrimspecialedition/mods/100",
    requiredBy: { modId: 7 },
    ...overrides,
  }) as unknown as IModRequirementExt;

describe("useModRequirementActions", () => {
  beforeEach(() => {
    openUrl.mockClear();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the required mod's page in the browser", () => {
    const { result } = renderHook(() => useModRequirementActions(api, requirement(), identity));

    result.current.openModPage();

    expect(openUrl).toHaveBeenCalledWith("https://www.nexusmods.com/skyrimspecialedition/mods/100");
  });

  // A game with no Nexus domain mapping leaves the requirement without a page to open.
  it("opens nothing when the mod has no page", () => {
    const { result } = renderHook(() =>
      useModRequirementActions(api, requirement({ modUrl: undefined }), identity),
    );

    result.current.openModPage();

    expect(openUrl).not.toHaveBeenCalled();
  });

  it("falls back to the mod page when there is no single file to open", () => {
    const { result } = renderHook(() =>
      useModRequirementActions(api, requirement({ mainFile: undefined }), identity),
    );

    result.current.openFilePage();

    expect(openUrl).toHaveBeenCalledWith("https://www.nexusmods.com/skyrimspecialedition/mods/100");
  });
});
