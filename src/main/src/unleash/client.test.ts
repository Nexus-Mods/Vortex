import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";

import { log } from "../logging";
import { UnleashClient } from "./client";

vi.mock("../logging", () => ({ log: vi.fn() }));

vi.mock("./constants", () => ({
  APP_NAME: "Vortex",
  BASE_URL: "https://unleash.test",
  API_KEY: "test-key",
  ENVIRONMENT: "development" as const,
  INTERVAL: 1_000,
}));

const fetchMocker = createFetchMock(vi);
fetchMocker.enableMocks();

function toggleBody(toggles: unknown[]): string {
  return JSON.stringify({ toggles });
}

describe("UnleashClient", () => {
  beforeEach(() => {
    fetchMocker.resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // fetchFeatureFlags
  // ============================================================

  describe("fetchFeatureFlags", () => {
    it("throws when the API returns an error status", async () => {
      fetchMocker.mockResponseOnce(
        JSON.stringify({ id: "1", name: "Unauthorized", message: "bad key" }),
        { status: 401 },
      );

      await expect(new UnleashClient("1.0.0").fetchFeatureFlags()).rejects.toThrow();
    });

    it("returns an empty array for an empty toggles list", async () => {
      fetchMocker.mockResponseOnce(toggleBody([]));

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([]);
    });

    it("skips toggles with unknown flag names", async () => {
      fetchMocker.mockResponseOnce(toggleBody([{ name: "unknown-flag", variant: null }]));

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([]);
    });

    it("returns a known flag with no variant", async () => {
      fetchMocker.mockResponseOnce(toggleBody([{ name: "vortex-test-flag", variant: null }]));

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([
        { name: "vortex-test-flag", variant: undefined },
      ]);
    });

    it("returns a known flag with a parsed numeric variant", async () => {
      fetchMocker.mockResponseOnce(
        toggleBody([
          {
            name: "vortex-test-flag",
            variant: { name: "variant-1", enabled: true, payload: { type: "string", value: "42" } },
          },
        ]),
      );

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([
        { name: "vortex-test-flag", variant: { name: "variant-1", data: 42 } },
      ]);
    });

    it("returns a known flag with a parsed object variant", async () => {
      fetchMocker.mockResponseOnce(
        toggleBody([
          {
            name: "vortex-test-flag",
            variant: {
              name: "variant-3",
              enabled: true,
              payload: { type: "string", value: JSON.stringify({ foo: "bar" }) },
            },
          },
        ]),
      );

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([
        { name: "vortex-test-flag", variant: { name: "variant-3", data: { foo: "bar" } } },
      ]);
    });

    it("omits the variant for an unknown variant name", async () => {
      fetchMocker.mockResponseOnce(
        toggleBody([
          {
            name: "vortex-test-flag",
            variant: {
              name: "no-such-variant",
              enabled: true,
              payload: { type: "string", value: "1" },
            },
          },
        ]),
      );

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([
        { name: "vortex-test-flag", variant: undefined },
      ]);
    });

    it("omits the variant when the payload fails schema validation", async () => {
      // variant-3 expects { foo: string } — passing a non-object fails the zod schema
      fetchMocker.mockResponseOnce(
        toggleBody([
          {
            name: "vortex-test-flag",
            variant: {
              name: "variant-3",
              enabled: true,
              payload: { type: "string", value: JSON.stringify(42) },
            },
          },
        ]),
      );

      expect(await new UnleashClient("1.0.0").fetchFeatureFlags()).toEqual([
        { name: "vortex-test-flag", variant: undefined },
      ]);
    });
  });

  // ============================================================
  // serializeContext (verified via the URL passed to fetch)
  // ============================================================

  describe("serializeContext", () => {
    async function fetchedParams(appVersion: string): Promise<URLSearchParams> {
      fetchMocker.mockResponseOnce(toggleBody([]));
      await new UnleashClient(appVersion).fetchFeatureFlags();
      return new URLSearchParams(new URL(fetchMocker.requests()[0].url).search);
    }

    it("serializes standard fields as flat query params", async () => {
      const params = await fetchedParams("1.0.0");
      expect(params.get("appName")).toBe("Vortex");
      expect(params.get("environment")).toBe("development");
      expect(params.has("sessionId")).toBe(true);
      expect(params.has("currentTime")).toBe(true);
    });

    it("serializes custom fields with bracket notation under properties", async () => {
      const params = await fetchedParams("2.5.0");
      expect(params.get("properties[appVersion]")).toBe("2.5.0");
      expect(params.has("properties[os]")).toBe(true);
    });

    it("sets channel to stable for a release version", async () => {
      const params = await fetchedParams("1.0.0");
      expect(params.get("properties[channel]")).toBe("stable");
    });

    it("sets channel to beta for a beta version", async () => {
      const params = await fetchedParams("1.0.0-beta.1");
      expect(params.get("properties[channel]")).toBe("beta");
    });

    it("omits userId when not set", async () => {
      const params = await fetchedParams("1.0.0");
      expect(params.has("userId")).toBe(false);
    });
  });

  // ============================================================
  // start (polling)
  // ============================================================

  describe("start", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls fetchFeatureFlags immediately", async () => {
      const client = new UnleashClient("1.0.0");
      const spy = vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

      client.start(1_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("schedules the next fetch after the interval on success", async () => {
      const client = new UnleashClient("1.0.0");
      const spy = vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

      client.start(1_000);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("applies exponential backoff after a failure", async () => {
      const client = new UnleashClient("1.0.0");
      const spy = vi
        .spyOn(client, "fetchFeatureFlags")
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValue([]);

      client.start(1_000);
      await vi.advanceTimersByTimeAsync(0); // first tick fails

      // 1 failure → next tick at 1000 * 2^1 = 2000ms
      await vi.advanceTimersByTimeAsync(1_999);
      expect(spy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("resets backoff to the base interval after a successful fetch", async () => {
      const client = new UnleashClient("1.0.0");
      const spy = vi
        .spyOn(client, "fetchFeatureFlags")
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValue([]);

      client.start(1_000);
      await vi.advanceTimersByTimeAsync(0); // first tick fails
      await vi.advanceTimersByTimeAsync(2_000); // wait out 2x backoff, second tick succeeds

      expect(spy).toHaveBeenCalledTimes(2);

      // Next interval should be back to base 1000ms
      await vi.advanceTimersByTimeAsync(999);
      expect(spy).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it("stops polling after 5 consecutive failures", async () => {
      const client = new UnleashClient("1.0.0");
      const spy = vi
        .spyOn(client, "fetchFeatureFlags")
        .mockRejectedValue(new Error("persistent error"));

      client.start(1_000);
      // Drive through 5 failures: backoffs are 2s, 4s, 8s, 16s (after failure 1-4; failure 5 stops)
      await vi.advanceTimersByTimeAsync(0); // failure 1
      await vi.advanceTimersByTimeAsync(2_000); // failure 2
      await vi.advanceTimersByTimeAsync(4_000); // failure 3
      await vi.advanceTimersByTimeAsync(8_000); // failure 4
      await vi.advanceTimersByTimeAsync(16_000); // failure 5 → stops

      const callCount = spy.mock.calls.length;
      await vi.advanceTimersByTimeAsync(100_000);
      expect(spy).toHaveBeenCalledTimes(callCount);
    });

    it("logs an error when polling is permanently disabled", async () => {
      const client = new UnleashClient("1.0.0");
      vi.spyOn(client, "fetchFeatureFlags").mockRejectedValue(new Error("persistent error"));

      client.start(1_000);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(4_000);
      await vi.advanceTimersByTimeAsync(8_000);
      await vi.advanceTimersByTimeAsync(16_000);

      expect(vi.mocked(log)).toHaveBeenCalledWith(
        "error",
        "unleash polling disabled after repeated failures",
      );
    });

    it("stop function cancels the pending timer", async () => {
      const client = new UnleashClient("1.0.0");
      const spy = vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

      const stop = client.start(1_000);
      await vi.advanceTimersByTimeAsync(0);

      stop();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("updates the flags getter after a successful fetch", async () => {
      const expected = [{ name: "vortex-test-flag" as const, variant: undefined }];
      const client = new UnleashClient("1.0.0");
      vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue(expected);

      client.start(1_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(client.flags).toEqual(expected);
    });
  });
});
