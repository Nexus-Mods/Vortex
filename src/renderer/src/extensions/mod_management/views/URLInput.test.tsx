import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TFunction } from "../../../util/i18n";
import type { IMod } from "../types/IMod";
import URLInput from "./URLInput";

vi.mock("react-redux", () => ({ useDispatch: () => vi.fn() }));
// The button's icon loads its font set into an `#icon-sets` element the test document lacks.
vi.mock("../../../controls/Icon", () => ({ default: () => null }));

const openUrl = vi.fn();
const t = ((key: string) => key) as unknown as TFunction;

const modWithUrl = (url: string) => ({ id: "a-mod", attributes: { url } }) as unknown as IMod;

describe("URLInput", () => {
  beforeEach(() => {
    openUrl.mockClear();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the mod's website in the browser", () => {
    render(<URLInput t={t} gameId="skyrimse" mod={modWithUrl("https://example.com/mod")} />);

    fireEvent.click(screen.getByTitle("Open website in your browser"));

    expect(openUrl).toHaveBeenCalledWith("https://example.com/mod");
  });

  // Source Website is free text, so the button stays off until it holds a URL.
  it("won't open text that isn't a URL", () => {
    render(<URLInput t={t} gameId="skyrimse" mod={modWithUrl("my mate's site")} />);

    expect(screen.getByTitle("Open website in your browser")).toBeDisabled();
  });
});
