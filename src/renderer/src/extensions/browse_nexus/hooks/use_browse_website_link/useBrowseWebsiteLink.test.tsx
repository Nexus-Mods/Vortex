import { renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ShownModPositionContext, useBrowseWebsiteLink } from "./useBrowseWebsiteLink.hook";

const MOD_PAGE = "https://www.nexusmods.com/skyrimspecialedition/mods/12604";

describe("useBrowseWebsiteLink", () => {
  it("says Browse sent the user, and where the shown mod is in the list", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ShownModPositionContext.Provider value={23}>{children}</ShownModPositionContext.Provider>
    );

    const { result } = renderHook(() => useBrowseWebsiteLink(), { wrapper });

    expect(result.current(MOD_PAGE)).toBe(`${MOD_PAGE}?source=vortex_browse&source_position=23`);
  });

  it("says only that Browse sent the user when the position isn't known", () => {
    const { result } = renderHook(() => useBrowseWebsiteLink());

    expect(result.current(MOD_PAGE)).toBe(`${MOD_PAGE}?source=vortex_browse`);
  });
});
