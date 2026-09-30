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

// The global stub (test-setup.ts) returns keys verbatim, so "{{percent}}%" never becomes
// "70%" — fine for most tests, but this file distinguishes radios by their rendered
// percentage, so it needs real interpolation instead.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => {
    const t = (key: string, options?: { replace?: Record<string, string | number> }) =>
      key.replace(/{{(\w+)}}/g, (_match, name: string) => String(options?.replace?.[name] ?? ""));
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
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
  it("puts Reduce motion and Zoom under Accessibility, and moves compact headers to Customisation", () => {
    renderForm();

    const accessibility = screen.getByText("Accessibility").closest(".form-group")!;
    const customisation = screen.getByText("Customisation").closest(".form-group")!;

    expect(accessibility).toContainElement(screen.getByText("Reduce motion"));
    expect(accessibility).toContainElement(screen.getByText("Zoom"));
    expect(customisation).toContainElement(screen.getByText("Always use compact headers"));
    expect(accessibility).not.toContainElement(screen.getByText("Always use compact headers"));
  });

  it("offers every 10% level from 50% to 150%, with 100% marked as the default", () => {
    renderForm();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(11);

    const defaultRadio = screen.getByRole("radio", { name: /100%.*Default/ });
    expect(defaultRadio).toBeChecked();
  });

  it("checks the radio matching the current zoom factor, not 100%", () => {
    state.current.settings.window.zoomFactor = 1.2;
    renderForm();

    expect(screen.getByRole("radio", { name: "120%" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /100%.*Default/ })).not.toBeChecked();
  });

  it("dispatches the chosen level when a different radio is selected", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("radio", { name: "70%" }));

    expect(dispatch).toHaveBeenCalledWith(setZoomFactor(0.7));
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
