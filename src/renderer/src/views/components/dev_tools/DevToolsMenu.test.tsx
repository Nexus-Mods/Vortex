import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), useModernLayout: true, newTable: false }));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      settings: { window: { useModernLayout: mocks.useModernLayout } },
      session: { devTools: { newTable: mocks.newTable } },
    }),
}));

import { setDevSetting } from "@/actions/devTools";
import { setUseModernLayout } from "@/actions/window";
import { getTheme } from "@/util/theme";

import { DevToolsMenu } from "./DevToolsMenu";

const open = async () => {
  render(<DevToolsMenu />);
  await userEvent.click(screen.getByTestId("dev-tools-trigger"));
};

describe("DevToolsMenu", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    delete document.documentElement.dataset.theme;
    mocks.dispatch = vi.fn();
    mocks.useModernLayout = true;
    mocks.newTable = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("switches the new table design", async () => {
    await open();

    await userEvent.click(screen.getByTestId("dev-tools-new-table"));

    expect(mocks.dispatch).toHaveBeenCalledWith(setDevSetting("newTable", true));
  });

  it("shows the new table design as on when it is", async () => {
    mocks.newTable = true;
    await open();

    expect(screen.getByTestId("dev-tools-new-table")).toHaveAttribute("aria-checked", "true");
  });

  it("shows it as off outside development, whatever is stored", async () => {
    mocks.newTable = true;
    vi.stubEnv("NODE_ENV", "production");
    await open();

    expect(screen.getByTestId("dev-tools-new-table")).toHaveAttribute("aria-checked", "false");
  });
});
