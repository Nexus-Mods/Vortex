import { VortexError } from "@vortex/shared";
import { describe, it, expect } from "vitest";

import { redactUrl, toUploadError } from "./errors";

describe("toUploadError", () => {
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
