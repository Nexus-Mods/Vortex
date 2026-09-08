import { ReadError, RequestError } from "got";
import { assert, describe, expect, it } from "vitest";

import { toNetworkError } from "./errors";

const url = new URL("https://cdn.nexusmods.com/files/mod.7z");

/** got attaches the request lazily; the classifier only reads the error itself. */
const noRequest = {} as never;

describe("toNetworkError", () => {
  it("keeps the POSIX classification of a reset connection", () => {
    const cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const result = toNetworkError(url, new RequestError(cause.message, cause, noRequest));

    assert(result.data.kind === "http:generic");
    expect(result.data.originalCode).toBe("ECONNRESET");
    expect(result.message).toBe("Network request failed");
  });

  it("treats a response stream that ended early as a transient network failure", () => {
    const cause = Object.assign(new Error("Content-Length mismatch: expected 10, received 5"), {
      code: "ERR_HTTP_CONTENT_LENGTH_MISMATCH",
    });
    const result = toNetworkError(url, new ReadError(cause, noRequest));

    assert(result.data.kind === "http:generic");
    expect(result.data.url).toBe(url.toString());
    expect(result.data.originalCode).toBe("ERR_HTTP_CONTENT_LENGTH_MISMATCH");
    expect(result.isTransient).toBe(true);
    expect(result.cause).toBeInstanceOf(ReadError);
  });
});
