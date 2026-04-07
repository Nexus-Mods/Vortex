import { describe, expect, it } from "vitest";

import { adaptorName, messageId, pid, semver, uri } from "./branded.js";

describe("uri", () => {
  it("accepts a valid URI", () => {
    const result = uri("vortex:host/ping");
    expect(result).toBe("vortex:host/ping");
  });

  it("rejects an empty string", () => {
    expect(() => uri("")).toThrow();
  });

  it("rejects a string without a colon", () => {
    expect(() => uri("no-scheme")).toThrow();
  });

  it("accepts URIs with path segments", () => {
    const result = uri("vortex:adaptor/ping-test/echo");
    expect(result).toBe("vortex:adaptor/ping-test/echo");
  });
});

describe("pid", () => {
  it("accepts a valid PID", () => {
    const result = pid("pid:42");
    expect(result).toBe("pid:42");
  });

  it("rejects a string without pid: prefix", () => {
    expect(() => pid("42")).toThrow();
  });

  it("rejects an empty pid", () => {
    expect(() => pid("pid:")).toThrow();
  });
});

describe("messageId", () => {
  it("accepts a valid message ID", () => {
    const result = messageId("msg:abc-123");
    expect(result).toBe("msg:abc-123");
  });

  it("rejects a string without msg: prefix", () => {
    expect(() => messageId("abc-123")).toThrow();
  });
});

describe("semver", () => {
  it("accepts a valid semver string", () => {
    const result = semver("1.0.0");
    expect(result).toBe("1.0.0");
  });

  it("accepts semver with pre-release", () => {
    const result = semver("1.0.0-beta.1");
    expect(result).toBe("1.0.0-beta.1");
  });

  it("rejects a non-semver string", () => {
    expect(() => semver("1.0")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => semver("")).toThrow();
  });
});

describe("adaptorName", () => {
  it("accepts a valid name with letters, digits, hyphens, underscores", () => {
    const result = adaptorName("ping-test_01");
    expect(result).toBe("ping-test_01");
  });

  it("rejects a name with spaces", () => {
    expect(() => adaptorName("ping test")).toThrow();
  });

  it("rejects a name with special characters", () => {
    expect(() => adaptorName("ping@test")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => adaptorName("")).toThrow();
  });
});
