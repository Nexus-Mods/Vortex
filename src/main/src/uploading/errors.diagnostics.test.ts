import { describe, it, expect } from "vitest";

import { describeErrorBody, describePresignedUrl, missingSignedHeaders } from "./errors";

describe("describeErrorBody", () => {
  it("names the reason an S3-compatible store gives for a rejection", () => {
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<Error><Code>SignatureDoesNotMatch</Code>",
      "<Message>The request signature we calculated does not match the signature you provided.</Message>",
      "<RequestId>ABC123</RequestId></Error>",
    ].join("\n");

    expect(describeErrorBody(body)).toBe(
      "SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided.",
    );
  });

  it("falls back to the code alone when there is no message", () => {
    expect(describeErrorBody("<Error><Code>AccessDenied</Code></Error>")).toBe("AccessDenied");
  });

  it("passes through a body that is not the expected XML", () => {
    expect(describeErrorBody("  plain\n  text  ")).toBe("plain text");
  });

  it("truncates a long unrecognised body", () => {
    const description = describeErrorBody("x".repeat(1000));

    expect(description).toHaveLength(401);
    expect(description?.endsWith("…")).toBe(true);
  });

  it("reports nothing for an empty body", () => {
    expect(describeErrorBody("")).toBeUndefined();
  });
});

describe("describePresignedUrl", () => {
  const signed = (params: Record<string, string>) =>
    `https://s3.example.com/bucket/key?${new URLSearchParams(params).toString()}`;

  it("reports which headers the signature covers", () => {
    const details = describePresignedUrl(
      signed({
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-SignedHeaders": "host;content-type",
        "X-Amz-Signature": "secret",
      }),
    );

    expect(details.signedHeaders).toBe("host;content-type");
    expect(details.algorithm).toBe("AWS4-HMAC-SHA256");
  });

  it("never includes the signature itself", () => {
    const details = describePresignedUrl(
      signed({ "X-Amz-SignedHeaders": "host", "X-Amz-Signature": "deadbeef" }),
    );

    expect(JSON.stringify(details)).not.toContain("deadbeef");
  });

  it("works out when the URL had already expired", () => {
    const details = describePresignedUrl(
      signed({ "X-Amz-Date": "20200101T000000Z", "X-Amz-Expires": "900" }),
    );

    expect(details.signedAt).toBe("2020-01-01T00:00:00.000Z");
    expect(details.expiresAt).toBe("2020-01-01T00:15:00.000Z");
    expect(details.expired).toBe(true);
  });

  it("omits expiry when the URL carries no date", () => {
    const details = describePresignedUrl(signed({ "X-Amz-SignedHeaders": "host" }));

    expect(details.expired).toBeUndefined();
    expect(details.expiresAt).toBeUndefined();
  });

  it("returns nothing for a value that is not a URL", () => {
    expect(describePresignedUrl("not a url")).toEqual({});
  });
});

describe("missingSignedHeaders", () => {
  const signed = (signedHeaders: string) =>
    `https://s3.example.com/key?${new URLSearchParams({ "X-Amz-SignedHeaders": signedHeaders }).toString()}`;

  it("names a signed header the request omits", () => {
    // The real failure: the v3 session signs content-disposition and the
    // request never carried one.
    const missing = missingSignedHeaders(signed("content-disposition;content-type;host"), [
      "content-type",
      "content-length",
    ]);

    expect(missing).toEqual(["content-disposition"]);
  });

  it("reports nothing when every signed header is sent", () => {
    const missing = missingSignedHeaders(signed("content-disposition;content-type;host"), [
      "content-type",
      "content-disposition",
      "content-length",
    ]);

    expect(missing).toEqual([]);
  });

  it("does not count headers the HTTP layer always supplies", () => {
    expect(missingSignedHeaders(signed("host;content-length"), [])).toEqual([]);
  });

  it("compares case-insensitively", () => {
    expect(missingSignedHeaders(signed("Content-Type"), ["CONTENT-TYPE"])).toEqual([]);
  });

  it("reports nothing for a URL that carries no signature", () => {
    expect(missingSignedHeaders("https://s3.example.com/key", ["content-type"])).toEqual([]);
    expect(missingSignedHeaders("not a url", [])).toEqual([]);
  });
});
