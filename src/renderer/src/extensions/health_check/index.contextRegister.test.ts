import { describe, test, expect, vi } from "vitest";

// Mock util/api to avoid import-time side-effects: Steam constructor calls
// ApplicationData.instance which is not initialised in a test environment.
vi.mock("../../util/api", () => ({
  getGame: vi.fn(),
  toPromise: vi.fn(),
  activeGameId: vi.fn(),
  nexusGameId: vi.fn(),
}));

// Also mock the modRequirementsCheck module for the same reason.
vi.mock("./checks/modRequirementsCheck", () => ({
  MOD_REQUIREMENTS_CHECK_ID: "nexus-mod-requirements",
  checkModRequirements: vi.fn().mockResolvedValue({
    checkId: "nexus-mod-requirements",
    status: "passed",
    severity: "info",
    message: "mocked",
    executionTime: 0,
    timestamp: new Date(0),
  }),
}));

import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IHealthCheck,
} from "../../types/IHealthCheck";

function makeCheck(id: string): IHealthCheck {
  return {
    id,
    name: id,
    description: "",
    category: HealthCheckCategory.Mods,
    severity: HealthCheckSeverity.Info,
    triggers: [HealthCheckTrigger.Manual],
    check: async () => ({
      checkId: id,
      status: "passed",
      severity: HealthCheckSeverity.Info,
      message: "ok",
      executionTime: 0,
      timestamp: new Date(0),
    }),
  };
}

describe("context.registerHealthCheck", () => {
  test("registers from both pre- and post-once() init phases without buffering", async () => {
    let onceCallback: (() => void) | undefined;
    const stub: any = {
      registerReducer: vi.fn(),
      registerSettings: vi.fn(),
      registerMainPage: vi.fn(),
      once: (cb: () => void) => {
        onceCallback = cb;
      },
      onStateChange: vi.fn(),
      api: {
        store: { getState: () => ({}), dispatch: vi.fn() },
        onStateChange: vi.fn(),
      },
    };

    const mod = await import("./index.js");
    const init = mod.default ?? (mod as unknown as { init: unknown }).init;
    if (typeof init !== "function") {
      throw new Error("health_check/index did not export init() as default");
    }
    init(stub);

    expect(typeof stub.registerHealthCheck).toBe("function");

    // The registry is created at the top of init() so this should land
    // directly, not be buffered for later flushing.
    expect(() => stub.registerHealthCheck(makeCheck("external"))).not.toThrow();

    expect(onceCallback).toBeDefined();
    expect(() => onceCallback!()).not.toThrow();

    // Same code path after once() fires.
    expect(() => stub.registerHealthCheck(makeCheck("post-once"))).not.toThrow();
  });
});
