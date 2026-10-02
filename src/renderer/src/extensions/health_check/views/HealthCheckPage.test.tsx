import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: () => undefined,
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
  });

  it("opens the Vortex tab of global settings", () => {
    render(<HealthCheckPage active api={api} />);

    fireEvent.click(screen.getByTestId("health-check-settings"));

    expect(mocks.dispatch).toHaveBeenCalledWith(setOpenMainPage("application_settings", false));
    expect(mocks.dispatch).toHaveBeenCalledWith(setSettingsPage("Vortex"));
  });
});
