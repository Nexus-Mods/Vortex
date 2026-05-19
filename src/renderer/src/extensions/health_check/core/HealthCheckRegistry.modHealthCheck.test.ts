import { describe, test, expect, vi, beforeEach } from "vitest";

import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IModHealthCheck,
} from "../../../types/IHealthCheck";
import { HealthCheckRegistry } from "./HealthCheckRegistry";
import * as perModRunner from "./perModRunner";

describe("HealthCheckRegistry IModHealthCheck dispatch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("routes IModHealthCheck through runPerModCheck", async () => {
    const stubResult = {
      checkId: "mod-check",
      status: "passed" as const,
      severity: HealthCheckSeverity.Info,
      message: "stub",
      executionTime: 0,
      timestamp: new Date(0),
    };
    const spy = vi.spyOn(perModRunner, "runPerModCheck").mockResolvedValue(stubResult);

    const hc: IModHealthCheck = {
      id: "mod-check",
      name: "mod-check",
      description: "",
      category: HealthCheckCategory.Mods,
      severity: HealthCheckSeverity.Info,
      triggers: [HealthCheckTrigger.Manual],
      checkMod: vi.fn(),
    };

    const api: any = { getState: () => ({}), store: undefined };
    const registry = new HealthCheckRegistry(api);
    registry.register(hc);

    const result = await registry.runHealthCheck("mod-check" as any, api, true);

    expect(spy).toHaveBeenCalledOnce();
    expect(result?.checkId).toBe("mod-check");
    expect(result?.message).toBe("stub");
  });

  test("routes IHealthCheck through the standard `check` path", async () => {
    const check = vi.fn().mockResolvedValue({
      checkId: "standard",
      status: "passed",
      severity: HealthCheckSeverity.Info,
      message: "direct",
      executionTime: 0,
      timestamp: new Date(0),
    });
    const perModSpy = vi.spyOn(perModRunner, "runPerModCheck");

    const registry = new HealthCheckRegistry({ getState: () => ({}), store: undefined } as any);
    registry.register({
      id: "standard",
      name: "standard",
      description: "",
      category: HealthCheckCategory.System,
      severity: HealthCheckSeverity.Info,
      triggers: [HealthCheckTrigger.Manual],
      check,
    });

    await registry.runHealthCheck("standard" as any, { getState: () => ({}) } as any, true);

    expect(check).toHaveBeenCalledOnce();
    expect(perModSpy).not.toHaveBeenCalled();
  });
});
