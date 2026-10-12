import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), useModernLayout: true }));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { window: { useModernLayout: mocks.useModernLayout } } }),
}));

import { setUseModernLayout } from "@/actions/window";
import { getTheme } from "@/util/theme";

import { DevToolsMenu } from "./DevToolsMenu";

const open = async () => {
  render(<DevToolsMenu />);
  await userEvent.click(screen.getByTestId("dev-tools-trigger"));
};

describe("DevToolsMenu", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    mocks.dispatch = vi.fn();
    mocks.useModernLayout = true;
  });

  it("switches the layout", async () => {
    await open();

    await userEvent.click(screen.getByTestId("dev-tools-modern-layout"));

    expect(mocks.dispatch).toHaveBeenCalledWith(setUseModernLayout(false));
  });

  it("switches the light theme", async () => {
    await open();

    await userEvent.click(screen.getByTestId("dev-tools-light-theme"));

    expect(getTheme()).toBe("light");
    expect(screen.getByTestId("dev-tools-light-theme")).toHaveAttribute("aria-checked", "true");
  });
});
