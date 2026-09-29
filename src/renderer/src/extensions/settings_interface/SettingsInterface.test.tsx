import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IParameters } from "@vortex/shared/cli";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setZoomFactor } from "@/actions";

import { setAlwaysCompactHeaders, setReduceMotion } from "./actions/interface";

const { baseState, dispatch, state } = vi.hoisted(() => {
  const baseState = () => ({
    session: { extensions: { available: [] } },
    settings: {
      automation: { deploy: false, enable: false, install: false, minimized: false, start: false },
      interface: {
        alwaysCompactHeaders: false,
        desktopNotifications: true,
        foregroundDL: false,
        hideTopLevelCategory: false,
        language: "en",
        profilesVisible: true,
        reduceMotion: false,
        relativeTimes: false,
      },
      notifications: { suppress: {} },
      window: { customTitlebar: true, zoomFactor: 1 },
    },
  });

  return { baseState, dispatch: vi.fn(), state: { current: baseState() } };
});

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { emitAndAwait: vi.fn() } }),
}));

// More reads `api` off the legacy ComponentEx context, which this test doesn't set up.
// It's unrelated to the Accessibility section under test, so stub it out rather than
// wiring up that legacy provider.
vi.mock("../../controls/More", () => ({ default: () => null }));

// Toggle's icon glyph loads a real font file from disk (via #icon-sets); irrelevant to
// what this file tests, and there's no fixture font under the test environment's paths.
vi.mock("../../controls/Icon", () => ({ default: () => null }));

vi.mock("react-redux", async () => {
  const actual = await vi.importActual<typeof ReactReduxTypes>("react-redux");

  return {
    ...actual,
    useDispatch: () => dispatch,
    useSelector: (selector: (input: unknown) => unknown) => selector(state.current),
  };
});

import { SettingsInterfaceForm } from "./SettingsInterface";

const startup = { attach: vi.fn(), detach: vi.fn() } as unknown as IParameters;

const renderForm = () =>
  render(
    <SettingsInterfaceForm
      changeStartup={vi.fn()}
      currentLanguage="en"
      extensions={[]}
      languages={[]}
      startup={startup}
      onReloadLanguages={vi.fn()}
    />,
  );

/** The toggle's clickable element; `.toggle-container` also wraps the label text. */
const toggleHandleFor = (label: string) =>
  screen.getByText(label).closest(".toggle-container")!.querySelector(".toggle")!;

beforeEach(() => {
  state.current = baseState();
  dispatch.mockClear();
});

describe("SettingsInterface Accessibility section", () => {
  it("groups Reduce motion, Always use compact headers, and Zoom under one heading", () => {
    renderForm();

    const section = screen.getByText("Accessibility").closest(".form-group")!;

    expect(section).toContainElement(screen.getByText("Reduce motion"));
    expect(section).toContainElement(screen.getByText("Always use compact headers"));
    expect(section).toContainElement(screen.getByText("Zoom"));
  });

  it("disables only Reset at the default 100% zoom", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Zoom out" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("dispatches a 10% step when Zoom in is clicked", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(dispatch).toHaveBeenCalledWith(setZoomFactor(1.1));
  });

  it("dispatches a 10% step when Zoom out is clicked", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));

    expect(dispatch).toHaveBeenCalledWith(setZoomFactor(0.9));
  });

  it("disables Zoom out at the 50% floor", () => {
    state.current.settings.window.zoomFactor = 0.5;
    renderForm();

    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).not.toBeDisabled();
  });

  it("disables Zoom in at the 150% ceiling", () => {
    state.current.settings.window.zoomFactor = 1.5;
    renderForm();

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).not.toBeDisabled();
  });

  it("resets to 100% and is enabled while zoomed", async () => {
    state.current.settings.window.zoomFactor = 1.3;
    renderForm();

    const reset = screen.getByRole("button", { name: "Reset" });
    expect(reset).not.toBeDisabled();

    await userEvent.click(reset);

    expect(dispatch).toHaveBeenCalledWith(setZoomFactor(1));
  });

  it("reflects the stored Reduce motion value and dispatches on toggle", async () => {
    state.current.settings.interface.reduceMotion = true;
    renderForm();

    const handle = toggleHandleFor("Reduce motion");
    expect(handle).toHaveClass("toggle-on");

    await userEvent.click(handle);

    expect(dispatch).toHaveBeenCalledWith(setReduceMotion(false));
  });

  it("reflects the stored Always use compact headers value and dispatches on toggle", async () => {
    state.current.settings.interface.alwaysCompactHeaders = false;
    renderForm();

    const handle = toggleHandleFor("Always use compact headers");
    expect(handle).toHaveClass("toggle-off");

    await userEvent.click(handle);

    expect(dispatch).toHaveBeenCalledWith(setAlwaysCompactHeaders(true));
  });
});
