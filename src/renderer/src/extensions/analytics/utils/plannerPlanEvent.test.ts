import { GameId, VortexGameId } from "@vortex/shared";
import { beforeEach, describe, expect, onTestFinished, vi } from "vitest";

import { FlagService } from "../../../FlagService";
import type { IHarnessReducerBinding } from "../../../test-utils/builders";
import { test, type IHarnessFixtures } from "../../../test-utils/harnessTest";
import { clearOAuthCredentials } from "../../nexus_integration/actions/account";
import { createVortexNexusV3InternalClient } from "../../nexus_integration/nexusV3Client";
import { setAnalytics } from "../actions/analytics.action";
import { numericNexusGameId } from "../mixpanel/numericGameId";
import analyticsSettingsReducer from "../reducers/settings.reducer";
import { emitPlannerPlanEvent, plannerPlanPayload } from "./plannerPlanEvent";

vi.mock("../../nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3InternalClient: vi.fn(),
}));
vi.mock("../mixpanel/numericGameId", () => ({ numericNexusGameId: vi.fn() }));

const SKYRIM_SE = VortexGameId("skyrimse");
const SKYRIM_SE_NEXUS_ID = GameId(1704);

// analytics consent; the harness starts logged in
const ANALYTICS_BINDING: IHarnessReducerBinding = {
  path: ["settings", "analytics"],
  reducer: analyticsSettingsReducer,
};

/** A harness whose user consented to analytics and is logged in. */
function makeConsentingApi(makeApi: IHarnessFixtures["makeApi"]) {
  const harness = makeApi(undefined, [ANALYTICS_BINDING]);
  harness.api.store.dispatch(setAnalytics(true));
  return harness;
}

/** Turns the planner telemetry flag on for the rest of the test. */
function enablePlannerTelemetry() {
  const flags = vi.spyOn(FlagService, "instance", "get").mockReturnValue({
    getFlag: (name: string) => (name === "vortex-planner-telemetry" ? { name } : undefined),
  } as unknown as FlagService);
  onTestFinished(() => flags.mockRestore());
}

const loggedWarnings = () =>
  vi
    .mocked(window.api)
    .log.mock.calls.filter((call) => call[0] === "warn")
    .map((call) => call[1]);

describe("plannerPlanPayload", () => {
  test("sends the figures a run measured and null for the rest", () => {
    expect(
      plannerPlanPayload(SKYRIM_SE_NEXUS_ID, { disk_entries: 3, error_kind: "fs:not-found" }),
    ).toEqual({
      game_id: "1704",
      mods: null,
      lockfile_files: null,
      generated_files: null,
      disk_entries: 3,
      scan_roots: null,
      first_run: null,
      resolve_ms: null,
      scan_ms: null,
      plan_ms: null,
      operations: null,
      case_mismatches: null,
      manifest_diff: null,
      error_kind: "fs:not-found",
    });
  });
});

describe("emitPlannerPlanEvent", () => {
  const telemetryEvent = vi.fn();
  const figuresOf = vi.fn(() => ({ lockfile_files: 2 }));

  beforeEach(() => {
    telemetryEvent.mockReset().mockResolvedValue({ accepted: 1, rejected: [] });
    vi.mocked(createVortexNexusV3InternalClient).mockReturnValue({
      telemetryEvent,
    } as unknown as ReturnType<typeof createVortexNexusV3InternalClient>);
    vi.mocked(numericNexusGameId).mockReturnValue(SKYRIM_SE_NEXUS_ID);
    figuresOf.mockClear();
    vi.mocked(window.api).log.mockClear();
    enablePlannerTelemetry();
  });

  test("sends a game's first plan run of the session as a planner_plan event", async ({
    makeApi,
  }) => {
    const harness = makeConsentingApi(makeApi);

    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);
    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);

    expect(telemetryEvent).toHaveBeenCalledTimes(1);
    expect(telemetryEvent.mock.calls[0][2]).toEqual({
      type: "planner_plan",
      version: 1,
      payload: plannerPlanPayload(SKYRIM_SE_NEXUS_ID, { lockfile_files: 2 }),
    });
    expect(figuresOf).toHaveBeenCalledTimes(1);
  });

  test("sends nothing, and builds no figures, with the planner telemetry flag off", async ({
    makeApi,
  }) => {
    const harness = makeConsentingApi(makeApi);
    vi.spyOn(FlagService, "instance", "get").mockReturnValue(undefined);

    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);

    expect(telemetryEvent).not.toHaveBeenCalled();
    expect(figuresOf).not.toHaveBeenCalled();
  });

  test("sends nothing without consent or login", async ({ makeApi }) => {
    const harness = makeConsentingApi(makeApi);
    harness.api.store.dispatch(setAnalytics(false));
    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);
    harness.api.store.dispatch(setAnalytics(true));
    harness.api.store.dispatch(clearOAuthCredentials(null));
    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);

    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("sends nothing for a game without a Nexus game id", async ({ makeApi }) => {
    const harness = makeConsentingApi(makeApi);
    vi.mocked(numericNexusGameId).mockReturnValue(null);

    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);

    expect(telemetryEvent).not.toHaveBeenCalled();
  });

  test("logs a failed send instead of throwing it", async ({ makeApi }) => {
    const harness = makeConsentingApi(makeApi);
    telemetryEvent.mockRejectedValueOnce(new Error("socket reset"));

    await expect(emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf)).resolves.toBeUndefined();
    expect(loggedWarnings()).toContain("planner-plan: telemetry submit failed");
  });

  test("logs figures that fail to build instead of throwing them", async ({ makeApi }) => {
    const harness = makeConsentingApi(makeApi);
    figuresOf.mockImplementationOnce(() => {
      throw new Error("no lockfile");
    });

    await expect(emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf)).resolves.toBeUndefined();
    expect(loggedWarnings()).toContain("planner-plan: telemetry submit failed");
  });

  test("logs a rejected event", async ({ makeApi }) => {
    const harness = makeConsentingApi(makeApi);
    telemetryEvent.mockResolvedValueOnce({ accepted: 0, rejected: [{ index: 0 }] });

    await emitPlannerPlanEvent(harness.api, SKYRIM_SE, figuresOf);

    expect(loggedWarnings()).toContain("planner-plan: telemetry event rejected");
  });
});
