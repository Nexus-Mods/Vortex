import * as fs from "node:fs/promises";

import type { FeatureFlag } from "@vortex/shared/flags";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";

import { log } from "../logging";
import { UnleashClient } from "./client";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

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
      return new URLSearchParams(new URL(fetchMocker.requests()[0]!.url).search);
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

    it("does not call onUpdate again when a fetch returns a value-equal flag set", async () => {
      const client = new UnleashClient("1.0.0");
      vi.spyOn(client, "fetchFeatureFlags").mockImplementation(() =>
        // fresh objects per fetch, like a real HTTP response
        Promise.resolve([{ name: "vortex-test-flag" as const, variant: undefined }]),
      );
      const onUpdate = vi.fn();

      client.start(1_000, onUpdate);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it("does not call onUpdate again when a fetch returns the same flags reordered", async () => {
      const client = new UnleashClient("1.0.0");
      vi.spyOn(client, "fetchFeatureFlags")
        .mockResolvedValueOnce([
          { name: "vortex-test-flag", variant: undefined },
          { name: "vortex-file-requirements-health-check", variant: undefined },
        ])
        .mockResolvedValueOnce([
          { name: "vortex-file-requirements-health-check", variant: undefined },
          { name: "vortex-test-flag", variant: undefined },
        ]);
      const onUpdate = vi.fn();

      client.start(1_000, onUpdate);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it("calls onUpdate again when the flag set changes", async () => {
      const client = new UnleashClient("1.0.0");
      vi.spyOn(client, "fetchFeatureFlags")
        .mockResolvedValueOnce([{ name: "vortex-test-flag", variant: undefined }])
        .mockResolvedValueOnce([
          { name: "vortex-test-flag", variant: { name: "variant-1", data: 1 } },
        ]);
      const onUpdate = vi.fn();

      client.start(1_000, onUpdate);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenLastCalledWith([
        { name: "vortex-test-flag", variant: { name: "variant-1", data: 1 } },
      ]);
    });

    it("updates the flags getter even when onUpdate is skipped", async () => {
      const flags = [{ name: "vortex-test-flag" as const, variant: undefined }];
      const client = new UnleashClient("1.0.0");
      vi.spyOn(client, "fetchFeatureFlags").mockImplementation(() =>
        Promise.resolve(structuredClone(flags)),
      );
      const onUpdate = vi.fn();

      client.start(1_000, onUpdate);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(client.flags).toEqual(flags);
    });
  });

  // ============================================================
  // cache
  // ============================================================

  describe("cache", () => {
    const CACHE_PATH = "/tmp/flag-cache.json";
    const knownToggle = { name: "vortex-test-flag", variant: null };
    const knownFlag = { name: "vortex-test-flag" as const, variant: undefined };

    function makeCache(overrides?: Partial<{ timestamp: number; toggles: unknown[] }>): string {
      return JSON.stringify({ timestamp: Date.now(), toggles: [knownToggle], ...overrides });
    }

    beforeEach(() => {
      vi.mocked(fs.readFile).mockReset();
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    describe("#loadCache via start", () => {
      beforeEach(() => vi.useFakeTimers());
      afterEach(() => vi.useRealTimers());

      it("calls onUpdate with cached flags before the first fetch when cache is valid", async () => {
        vi.mocked(fs.readFile).mockImplementation(() => Promise.resolve(makeCache()));

        const onUpdate = vi.fn();
        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000, onUpdate);
        await vi.advanceTimersByTimeAsync(0);

        expect(onUpdate).toHaveBeenCalledWith([knownFlag]);
      });

      it("does not call onUpdate for a first fetch that matches the cache replay", async () => {
        vi.mocked(fs.readFile).mockImplementation(() => Promise.resolve(makeCache()));

        const onUpdate = vi.fn();
        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        vi.spyOn(client, "fetchFeatureFlags").mockImplementation(() =>
          Promise.resolve([structuredClone(knownFlag)]),
        );

        client.start(1_000, onUpdate);
        await vi.advanceTimersByTimeAsync(0);

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith([knownFlag]);
      });

      it("does not call onUpdate from cache when the cache is expired", async () => {
        const expired = Date.now() - 25 * 60 * 60 * 1000;
        vi.mocked(fs.readFile).mockImplementation(() =>
          Promise.resolve(makeCache({ timestamp: expired })),
        );

        const onUpdate = vi.fn();
        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000, onUpdate);
        await vi.advanceTimersByTimeAsync(0);

        expect(vi.mocked(log)).toHaveBeenCalledWith("debug", "flag cache is expired, ignoring");
        const cachedCall = onUpdate.mock.calls.find((args) =>
          (args[0] as FeatureFlag[]).some((f) => f.name === "vortex-test-flag"),
        );
        expect(cachedCall).toBeUndefined();
      });

      it("does not read from disk when cachePath is not set", async () => {
        const client = new UnleashClient("1.0.0");
        vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(fs.readFile).not.toHaveBeenCalled();
      });

      it("ignores a missing cache file and proceeds to fetch", async () => {
        vi.mocked(fs.readFile).mockRejectedValue(
          Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
        );

        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        const fetchSpy = vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      it("ignores corrupt JSON in the cache file", async () => {
        vi.mocked(fs.readFile).mockImplementation(() => Promise.resolve("not json"));

        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000);
        await vi.advanceTimersByTimeAsync(0);
        // no assertion needed -- the test passes if nothing throws
      });

      it("ignores a cache file with wrong shape", async () => {
        vi.mocked(fs.readFile).mockImplementation(() =>
          Promise.resolve(JSON.stringify({ wrong: true })),
        );

        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(vi.mocked(log)).toHaveBeenCalledWith(
          "debug",
          "flag cache has unexpected shape, ignoring",
        );
      });

      it("respects a custom cacheTtlMs", async () => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        vi.mocked(fs.readFile).mockImplementation(() =>
          Promise.resolve(makeCache({ timestamp: fiveMinutesAgo })),
        );

        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH, cacheTtlMs: 60_000 });
        vi.spyOn(client, "fetchFeatureFlags").mockResolvedValue([]);

        client.start(1_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(vi.mocked(log)).toHaveBeenCalledWith("debug", "flag cache is expired, ignoring");
      });
    });

    describe("#writeCache via fetchFeatureFlags", () => {
      it("writes raw toggles and a timestamp after a successful fetch", async () => {
        fetchMocker.mockResponseOnce(toggleBody([knownToggle]));

        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        await client.fetchFeatureFlags();
        await Promise.resolve(); // settle the fire-and-forget write

        expect(fs.writeFile).toHaveBeenCalledOnce();
        const [writtenPath, writtenContent] = vi.mocked(fs.writeFile).mock.calls[0]!;
        expect(writtenPath).toBe(CACHE_PATH);
        const written = JSON.parse(writtenContent as string) as {
          timestamp: number;
          toggles: unknown[];
        };
        expect(typeof written.timestamp).toBe("number");
        expect(written.toggles).toEqual([knownToggle]);
      });

      it("does not write to disk when cachePath is not set", async () => {
        fetchMocker.mockResponseOnce(toggleBody([knownToggle]));

        await new UnleashClient("1.0.0").fetchFeatureFlags();
        await Promise.resolve();

        expect(fs.writeFile).not.toHaveBeenCalled();
      });

      it("swallows write errors and logs a warning", async () => {
        fetchMocker.mockResponseOnce(toggleBody([knownToggle]));
        vi.mocked(fs.writeFile).mockRejectedValue(new Error("disk full"));

        const client = new UnleashClient("1.0.0", { cachePath: CACHE_PATH });
        await expect(client.fetchFeatureFlags()).resolves.toBeDefined();
        await Promise.resolve();

        expect(vi.mocked(log)).toHaveBeenCalledWith(
          "warn",
          "failed to write flag cache",
          expect.anything(),
        );
      });
    });
  });

  // ============================================================
  // postMetrics
  // ============================================================

  describe("postMetrics", () => {
    it("POSTs to /api/frontend/client/metrics", async () => {
      fetchMocker.mockResponseOnce("", { status: 200 });

      await new UnleashClient("1.0.0").postMetrics({
        start: 1_000,
        stop: 2_000,
        toggles: { "vortex-test-flag": { yes: 3, no: 1 } },
      });

      expect(fetchMocker.requests()[0]!.url).toContain("/api/frontend/client/metrics");
      expect(fetchMocker.requests()[0]!.method).toBe("POST");
    });

    it("includes appName in the request body", async () => {
      fetchMocker.mockResponseOnce("", { status: 200 });

      await new UnleashClient("1.0.0").postMetrics({
        start: 1_000,
        stop: 2_000,
        toggles: {},
      });

      const body = JSON.parse(await fetchMocker.requests()[0]!.text()) as Record<string, unknown>;
      expect(body["appName"]).toBe("Vortex");
    });

    it("includes ISO timestamps in the bucket", async () => {
      fetchMocker.mockResponseOnce("", { status: 200 });

      await new UnleashClient("1.0.0").postMetrics({
        start: 0,
        stop: 60_000,
        toggles: {},
      });

      const body = JSON.parse(await fetchMocker.requests()[0]!.text()) as {
        bucket: { start: string; stop: string };
      };
      expect(body.bucket.start).toBe(new Date(0).toISOString());
      expect(body.bucket.stop).toBe(new Date(60_000).toISOString());
    });

    it("passes toggle counts through unchanged", async () => {
      fetchMocker.mockResponseOnce("", { status: 200 });

      const toggles = {
        "vortex-test-flag": { yes: 5, no: 2, variants: { "variant-1": 3 } },
      };
      await new UnleashClient("1.0.0").postMetrics({ start: 0, stop: 1, toggles });

      const body = JSON.parse(await fetchMocker.requests()[0]!.text()) as {
        bucket: { toggles: typeof toggles };
      };
      expect(body.bucket.toggles).toEqual(toggles);
    });

    it("throws when the API returns an error status", async () => {
      fetchMocker.mockResponseOnce(
        JSON.stringify({ id: "1", name: "Unauthorized", message: "bad key" }),
        { status: 401 },
      );

      await expect(
        new UnleashClient("1.0.0").postMetrics({ start: 0, stop: 1, toggles: {} }),
      ).rejects.toThrow();
    });
  });
});
