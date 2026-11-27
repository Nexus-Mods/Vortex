import { act, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { combineReducers, createStore, type Store } from "redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

vi.mock("../hooks/healthCheckTracker", () => ({
  createHealthCheckTracker: () => new Proxy({}, { get: () => vi.fn() }),
}));

import { HealthCheckSeverity } from "@/types/IHealthCheck";

import { setHealthCheckResult } from "../actions/session";
import {
  FOMOD_OPTIONS_CHECK_ID,
  type IFomodOptionsCheckMetadata,
} from "../checks/fomodOptionsCheck";
import { type IHealthCheckSessionState, sessionReducer } from "../reducers/session";
import HealthCheckPage from "./HealthCheckPage";

interface ITestAction {
  type: string;
  payload?: unknown;
}

/**
 * The real listing path: `selectListedEntries` is NOT mocked here, so this exercises the
 * registry, the fomod content module and the page's memos together. Mocking it away would
 * hide exactly the bug this file exists for.
 */
const makeStore = () =>
  createStore(
    combineReducers({
      session: combineReducers({
        healthCheck: (
          state: IHealthCheckSessionState = sessionReducer.defaults,
          action: ITestAction,
        ) => sessionReducer.reducers[action.type]?.(state, action.payload) ?? state,
      }),
      persistent: (
        state = { healthCheck: { hiddenRequirements: {}, hiddenFileRequirements: {} } },
      ) => state,
      confidential: (state = { account: {} }) => state,
      settings: (
        state = {
          interface: { alwaysCompactHeaders: false, language: "en" },
          profiles: { activeProfileId: undefined, lastActiveProfile: {} },
        },
      ) => state,
    }),
  );

const fomodResult = {
  checkId: FOMOD_OPTIONS_CHECK_ID,
  status: "warning" as const,
  severity: HealthCheckSeverity.Warning,
  message: "1 installer option available across 1 mod",
  executionTime: 1,
  timestamp: new Date(),
  metadata: {
    modsChecked: 1,
    modsWithoutSnapshot: 0,
    issues: [
      {
        modId: "mod-a",
        modName: "Mod A",
        collectionManaged: false,
        options: [
          {
            stepName: "Compat",
            groupName: "Patches",
            optionName: "Patch for Mod B",
            wasType: "NotUsable" as const,
            nowType: "Required" as const,
            reason: "b.esp",
          },
        ],
      },
    ],
  } satisfies IFomodOptionsCheckMetadata,
};

let store: Store;

const wrapper = ({ children }: { children?: ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);

const makeApi = (): IExtensionApi =>
  ({
    getState: () => store.getState(),
    events: { emit: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
    showErrorNotification: vi.fn(),
  }) as unknown as IExtensionApi;

describe("HealthCheckPage with the installer-options check", () => {
  beforeEach(() => {
    store = makeStore();
  });

  it("lists a fomod issue that arrives after the page is already mounted", () => {
    // The regression: the page's item memo subscribed only to the other two checks' results,
    // so a fomod-only write changed no dependency and the list never recomputed. The feature
    // was invisible until an unrelated mod or file result happened to change.
    render(<HealthCheckPage active api={makeApi()} />, { wrapper });

    expect(screen.queryByText("Mod A")).toBeNull();

    act(() => {
      store.dispatch(setHealthCheckResult(FOMOD_OPTIONS_CHECK_ID, fomodResult));
    });

    expect(screen.getByText("Mod A")).toBeVisible();
    // The row is the fomod one, not a leftover from another check.
    expect(
      screen.getByRole("button", { name: "listing::fomod_options::change_options" }),
    ).toBeVisible();
  });

  it("drops the row when a later run finds the option gone", () => {
    store.dispatch(setHealthCheckResult(FOMOD_OPTIONS_CHECK_ID, fomodResult));

    render(<HealthCheckPage active api={makeApi()} />, { wrapper });

    expect(screen.getByText("Mod A")).toBeVisible();

    act(() => {
      store.dispatch(
        setHealthCheckResult(FOMOD_OPTIONS_CHECK_ID, {
          ...fomodResult,
          status: "passed",
          metadata: { modsChecked: 1, modsWithoutSnapshot: 0, issues: [] },
        }),
      );
    });

    expect(screen.queryByText("Mod A")).toBeNull();
  });
});
