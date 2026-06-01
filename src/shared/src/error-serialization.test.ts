import { describe, it, expect } from "vitest";

import { serializeError, deserializeError } from "./error-serialization";
import { DownloadError, HTTPError } from "./types/errors";

// A round-trip mirrors what crosses the IPC boundary: serialize on one side,
// hand the plain object to the other, deserialize there.
const roundTrip = (err: unknown): Error => deserializeError(serializeError(err));

describe("serializeError / deserializeError", () => {
  describe("generic errors", () => {
    it("preserves name and message", () => {
      const out = roundTrip(new Error("boom"));
      expect(out).toBeInstanceOf(Error);
      expect(out.name).toBe("Error");
      expect(out.message).toBe("boom");
    });

    it("rehydrates built-in error subclasses by name", () => {
      const out = roundTrip(new TypeError("nope"));
      expect(out).toBeInstanceOf(TypeError);
      expect(out.message).toBe("nope");
    });

    it("preserves own-enumerable properties", () => {
      const err = Object.assign(new Error("fail"), { code: "EACCES", retries: 3 });
      const out = roundTrip(err) as Error & { code: string; retries: number };
      expect(out.code).toBe("EACCES");
      expect(out.retries).toBe(3);
    });

    it("preserves the stack", () => {
      const err = new Error("with stack");
      const out = roundTrip(err);
      expect(out.stack).toBe(err.stack);
    });

    it("preserves a nested cause chain", () => {
      const root = new Error("root");
      const out = roundTrip(new Error("outer", { cause: root }));
      expect((out.cause as Error).message).toBe("root");
    });

    it("coerces non-Error throwables", () => {
      expect(roundTrip("just a string").message).toBe("just a string");
      expect(roundTrip(42).message).toBe("42");
    });
  });

  describe("registered Vortex classes", () => {
    it("round-trips HTTPError with its getter-backed fields", () => {
      const out = roundTrip(new HTTPError(404, "Not Found", "https://example.com"));
      expect(out).toBeInstanceOf(HTTPError);
      const http = out as HTTPError;
      expect(http.statusCode).toBe(404);
      expect(http.statusMessage).toBe("Not Found");
      expect(http.url).toBe("https://example.com");
    });

    it("round-trips DownloadError including its payload and URL", () => {
      const err = new DownloadError(
        { code: "network-bad-status", url: new URL("https://cdn.example/file"), statusCode: 503 },
        "server unavailable",
      );
      const out = roundTrip(err);
      expect(out).toBeInstanceOf(DownloadError);
      const dl = out as DownloadError;
      expect(dl.code).toBe("network-bad-status");
      expect(dl.payload).toMatchObject({ statusCode: 503 });
      expect((dl.payload as { url: URL }).url).toBeInstanceOf(URL);
      expect((dl.payload as { url: URL }).url.toString()).toBe("https://cdn.example/file");
    });

    it("round-trips a payload variant without a URL", () => {
      const out = roundTrip(new DownloadError({ code: "cancellation" }, "canceled"));
      expect(out).toBeInstanceOf(DownloadError);
      expect((out as DownloadError).code).toBe("cancellation");
    });
  });
});
