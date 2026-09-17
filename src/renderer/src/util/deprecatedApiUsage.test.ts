/**
 * Tests for the deprecation-reporting mechanism: log dedup is method-global while the Mixpanel
 * event is deduped per extension and method, event properties derive from the caller's resolved
 * installed-extension state, and the property-read trap replaces registered surfaces per caller
 * while passing everything else through untouched.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  log: vi.fn(),
}));

vi.mock("../extensions/analytics/mixpanel/MixpanelAnalytics", () => ({
  default: { trackEvent: mocks.trackEvent },
}));

vi.mock("../logging", () => ({
  log: mocks.log,
}));

import type { IRegisteredExtension } from "../types/extensions";
import type { IExtensionState } from "../types/IState";
import {
  deprecatedApiGet,
  registerDeprecatedApi,
  reportDeprecatedApiUsage,
  resetDeprecatedApiState,
  wrapDeprecatedSurface,
} from "./deprecatedApiUsage";

function makeExt(name: string, path?: string): IRegisteredExtension {
  return {
    name,
    namespace: name,
    path: path ?? `/plugins/${name}`,
    dynamic: false,
    initFunc: () => () => true,
  };
}

function makeState(name: string, overrides: Partial<IExtensionState> = {}): IExtensionState {
  return {
    enabled: true,
    remove: false,
    name,
    author: "someone",
    description: "",
    version: "1.2.3",
    path: `/plugins/${name}`,
    endorsed: "Undecided",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.trackEvent.mockClear();
  mocks.log.mockClear();
  resetDeprecatedApiState();
});

describe("reportDeprecatedApiUsage dedup", () => {
  it("logs once per method across callers, naming the first reporter", () => {
    reportDeprecatedApiUsage(
      makeExt("ext-a"),
      undefined,
      "steam.findByAppId",
      "use GameStoreHelper",
    );
    reportDeprecatedApiUsage(
      makeExt("ext-b"),
      undefined,
      "steam.findByAppId",
      "use GameStoreHelper",
    );

    expect(mocks.log).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith("warn", '"steam.findByAppId" is deprecated', {
      replacement: "use GameStoreHelper",
      extension: "ext-a",
    });
  });

  it("emits one event per extension and method pair", () => {
    reportDeprecatedApiUsage(makeExt("ext-a"), undefined, "steam.findByAppId", undefined);
    reportDeprecatedApiUsage(makeExt("ext-a"), undefined, "steam.findByAppId", undefined);
    reportDeprecatedApiUsage(makeExt("ext-b"), undefined, "steam.findByAppId", undefined);
    reportDeprecatedApiUsage(makeExt("ext-a"), undefined, "steam.findByName", undefined);

    expect(mocks.trackEvent).toHaveBeenCalledTimes(3);
    const names = mocks.trackEvent.mock.calls.map(([event]) => event.properties.extension_name);
    const methods = mocks.trackEvent.mock.calls.map(([event]) => event.properties.api_method);
    expect(names).toEqual(["ext-a", "ext-b", "ext-a"]);
    expect(methods).toEqual(["steam.findByAppId", "steam.findByAppId", "steam.findByName"]);
  });
});

describe("event property derivation", () => {
  it("takes identity fields from the installed-extension state", () => {
    reportDeprecatedApiUsage(
      makeExt("ext-a"),
      makeState("ext-a", { version: "3.0.0", modId: 434, fileId: 98765, bundled: false }),
      "steam.findByAppId",
      undefined,
    );

    expect(mocks.trackEvent).toHaveBeenCalledTimes(1);
    const event = mocks.trackEvent.mock.calls[0][0];
    expect(event.eventName).toBe("app_deprecated_api_used");
    expect(event.properties).toEqual({
      api_method: "steam.findByAppId",
      extension_name: "ext-a",
      extension_version: "3.0.0",
      mod_id: 434,
      file_id: 98765,
      bundled: false,
    });
  });

  it("omits fields without a state entry", () => {
    reportDeprecatedApiUsage(makeExt("bundled-ext"), undefined, "steam.id", undefined);

    const event = mocks.trackEvent.mock.calls[0][0];
    expect(event.properties).toEqual({
      api_method: "steam.id",
      extension_name: "bundled-ext",
      bundled: false,
    });
  });

  it("marks state-resolved bundled extensions", () => {
    reportDeprecatedApiUsage(
      makeExt("game-skyrimse"),
      makeState("game-skyrimse", { bundled: true }),
      "steam.findByName",
      undefined,
    );

    expect(mocks.trackEvent.mock.calls[0][0].properties.bundled).toBe(true);
  });
});

describe("deprecatedApiGet wrapping", () => {
  it("replaces registered surfaces with a stable per-caller instance", () => {
    const base = { findByAppId: (appId: string) => `result:${appId}` };
    registerDeprecatedApi("util.steam", {
      makeForCaller: (report) =>
        wrapDeprecatedSurface("steam", "use GameStoreHelper", base, report),
    });

    const api = { util: { steam: base, GameStoreHelper: {} } };
    const extA = makeExt("ext-a");
    const extB = makeExt("ext-b");

    const utilA = deprecatedApiGet(api, "util", "", extA, undefined);
    const shimA1 = utilA.steam;
    const shimA2 = utilA.steam;
    const shimB = deprecatedApiGet(api, "util", "", extB, undefined).steam;

    // Identity via booleans: running expect() on the proxy objects makes the test framework
    // introspect them, which would count as usage.
    expect(shimA1 === base).toBe(false);
    expect(shimA1 === shimA2).toBe(true);
    expect(shimB === shimA1).toBe(false);

    expect(shimA1.findByAppId("123")).toBe("result:123");
    expect(mocks.trackEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackEvent.mock.calls[0][0].properties).toMatchObject({
      api_method: "steam.findByAppId",
      extension_name: "ext-a",
    });
    expect(mocks.log).toHaveBeenCalledWith("warn", '"steam.findByAppId" is deprecated', {
      replacement: "use GameStoreHelper",
      extension: "ext-a",
    });
  });

  it("reports functions and properties identically, once per pair", () => {
    const base = { id: "steam", findByAppId: (appId: string) => `result:${appId}` };
    registerDeprecatedApi("util.steam", {
      makeForCaller: (report) => wrapDeprecatedSurface("steam", undefined, base, report),
    });
    const api = { util: { steam: base } };
    const shim = deprecatedApiGet(api, "util", "", makeExt("ext-a"), undefined).steam;

    expect(shim.id).toBe("steam");
    expect(shim.findByAppId).toBeTypeOf("function");
    void shim.id;
    // Symbol-keyed reads are framework inspection, not usage: they must not report.
    void (shim as Record<PropertyKey, unknown>)[Symbol.toStringTag];

    const methods = mocks.trackEvent.mock.calls.map(([event]) => event.properties.api_method);
    expect(methods).toEqual(["steam.id", "steam.findByAppId"]);
  });

  it("passes unregistered members through untouched, including symbols", () => {
    const helper = { findByAppId: () => "helper" };
    const helperSymbol = Symbol.for("test.GameStoreHelper");
    const api = { util: { steam: {}, GameStoreHelper: helper }, [helperSymbol]: "value" };

    const util = deprecatedApiGet(api, "util", "", makeExt("ext-a"), undefined);
    expect(util.GameStoreHelper).toBe(helper);
    expect(
      deprecatedApiGet(api, helperSymbol as keyof typeof api, "", makeExt("ext-a"), undefined),
    ).toBe("value");
  });
});
