import { HTTPError, NexusError, RateLimitError } from "@nexusmods/nexus-api";
import { describe, expect } from "vitest";

import { test } from "@/test-utils/harnessTest";

import { isRateLimited } from "./rateLimit";
import { handleGraphError } from "./util";

const TRACKED_MODS_URL = "https://api.nexusmods.com/v1/user/tracked_mods";

/** A 429 as nexus-api's GET path rejects it. */
const httpRateLimit = () => new HTTPError(429, "Request Failed", "", TRACKED_MODS_URL);

describe("rate limiting", () => {
  describe("isRateLimited", () => {
    test("recognises the plain HTTPError a throttled GET rejects with", () => {
      expect(isRateLimited(httpRateLimit())).toBe(true);
    });

    test("recognises the classified error, for the paths that produce one", () => {
      expect(isRateLimited(new RateLimitError())).toBe(true);
    });

    test("recognises a 429 the api described in its body", () => {
      expect(isRateLimited(new NexusError("Too Many Requests", 429, TRACKED_MODS_URL, ""))).toBe(
        true,
      );
    });

    test("leaves every other failure alone", () => {
      expect(isRateLimited(new Error("network down"))).toBe(false);
      expect(isRateLimited(new HTTPError(500, "Request Failed", "", TRACKED_MODS_URL))).toBe(false);
      expect(isRateLimited(undefined)).toBe(false);
    });
  });

  describe("handleGraphError", () => {
    // a rate limit is not a Vortex bug, so it must not reach the user with a Report button
    test("warns about a rate limit rather than raising a reportable error", ({ makeApi }) => {
      const harness = makeApi();

      const result = handleGraphError(harness.api, httpRateLimit(), {
        title: "Failed to get list of collections",
        fallback: [],
      });

      expect(result).toEqual([]);
      expect(harness.errorNotifications).toHaveLength(0);
      expect(harness.notifications).toEqual([expect.objectContaining({ type: "warning" })]);
    });

    test("still reports a failure that isn't a rate limit", ({ makeApi }) => {
      const harness = makeApi();

      handleGraphError(harness.api, new Error("boom"), {
        title: "Failed to get list of collections",
        fallback: [],
      });

      expect(harness.errorNotifications).toEqual([
        expect.objectContaining({ title: "Failed to get list of collections", allowReport: true }),
      ]);
    });
  });
});
