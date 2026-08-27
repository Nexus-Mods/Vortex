import { serializeError, VortexError } from "@vortex/shared";
import { describe, it, expect } from "vitest";

import { redactUrl, toUploadError } from "./errors";

/**
 * An error thrown out of an upload crosses IPC, where Electron
 * structured-clones the serialized envelope. A live library error carries
 * sockets and streams on itself, and one of those anywhere in the graph makes
 * the whole envelope uncloneable — the handler then dies with "An object could
 * not be cloned" and the real failure is never reported.
 *
 * `errors.test.integration.ts` covers the same guarantee against a real got
 * error; this stands in for one cheaply.
 */
function errorWithLiveReferences(): Error {
  const err = new Error("socket hang up") as Error & { code: string };
  err.code = "ECONNRESET";
  // got attaches its request/response this way — non-enumerable, so it is
  // invisible to Object.entries but not to Object.getOwnPropertyNames.
  Object.defineProperty(err, "request", {
    enumerable: false,
    value: { socket: new (class Socket {})(), write: () => {} },
  });
  Object.defineProperty(err, "options", {
    enumerable: true,
    value: { hooks: { beforeError: [() => {}] } },
  });
  return err;
}

describe("toUploadError", () => {
  it("produces an error whose serialized form can cross IPC", () => {
    const err = toUploadError("https://s3.example.com/upload", errorWithLiveReferences());

    const serialized = serializeError(err);

    expect(() => structuredClone(serialized)).not.toThrow();
  });

  it("keeps the details the renderer needs", () => {
    const err = new VortexError(
      "Server returned 403",
      {
        kind: "http:bad-status",
        url: "https://s3.example.com/upload",
        statusCode: 403,
      },
      { cause: errorWithLiveReferences() },
    );

    const serialized = serializeError(err);

    expect(() => structuredClone(serialized)).not.toThrow();
    expect(serialized.name).toBe("VortexError");
    expect(serialized.message).toBe("Server returned 403");
    // VortexError's `data` field is its own property and gets copied under
    // `serialized.data.data` (the envelope's own `data` bag).
    expect(serialized.data?.data).toMatchObject({
      kind: "http:bad-status",
      url: "https://s3.example.com/upload",
      statusCode: 403,
    });
    // The cause survives as a message/name/code, minus its live references.
    expect(serialized.cause?.code).toBe("ECONNRESET");
  });

  it("classifies an unrecognised failure as unknown", () => {
    const err = toUploadError("https://s3.example.com/upload", new Error("something odd"));

    expect(err).toBeInstanceOf(VortexError);
    expect(err.data.kind).toBe("unknown");
  });
});

describe("redactUrl", () => {
  it("drops the query string that carries the credential", () => {
    expect(
      redactUrl("https://s3.example.com/bucket/key?X-Amz-Signature=secret&X-Amz-Expires=900"),
    ).toBe("https://s3.example.com/bucket/key");
  });

  it("does not throw on a value that is not a URL", () => {
    expect(redactUrl("not a url")).toBe("<unparseable url>");
  });
});
