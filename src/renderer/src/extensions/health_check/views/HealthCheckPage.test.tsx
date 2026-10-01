import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  spine: undefined as { selectGlobalPage: ReturnType<typeof vi.fn> } | undefined,
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: () => undefined,
}));

vi.mock("@/views/components/Spine/SpineContext", () => ({
  useOptionalSpineContext: () => mocks.spine,
}));

vi.mock("../hooks/healthCheckTracker", () => ({
  createHealthCheckTracker: () => new Proxy({}, { get: () => vi.fn() }),
}));

vi.mock("../utils/shared/listedEntries", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  selectListedEntries: () => [],
}));

import { setOpenMainPage, setSettingsPage } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";

import HealthCheckPage from "./HealthCheckPage";

const api = {
  getState: () => ({}),
  events: { emit: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
} as unknown as IExtensionApi;

describe("HealthCheckPage", () => {
  beforeEach(() => {
    mocks.dispatch = vi.fn();
    mocks.spine = undefined;
  });

  it("opens global settings through the spine, so Home becomes active", () => {
    mocks.spine = { selectGlobalPage: vi.fn() };
    render(<HealthCheckPage active api={api} />);

    fireEvent.click(screen.getByTestId("health-check-settings"));

    expect(mocks.spine.selectGlobalPage).toHaveBeenCalledWith("application_settings");
    expect(mocks.dispatch).not.toHaveBeenCalledWith(setOpenMainPage("application_settings", false));
    expect(mocks.dispatch).toHaveBeenCalledWith(setSettingsPage("Vortex"));
  });

  it("still opens settings without a spine, as in the classic layout", () => {
    render(<HealthCheckPage active api={api} />);

    fireEvent.click(screen.getByTestId("health-check-settings"));

    expect(mocks.dispatch).toHaveBeenCalledWith(setOpenMainPage("application_settings", false));
    expect(mocks.dispatch).toHaveBeenCalledWith(setSettingsPage("Vortex"));
  });
});
