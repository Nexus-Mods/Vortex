import { describe, expect, it } from "vitest";

import { feedbackApiBase } from "./apiBase";

describe("feedbackApiBase", () => {
  it.each([undefined, ""])("is unset when the variable is %j", (value) => {
    expect(feedbackApiBase(value)).toBeUndefined();
  });

  it.each([
    ["http://localhost:9878", "http://localhost:9878"],
    ["http://127.0.0.1:9878/", "http://127.0.0.1:9878"],
    ["http://[::1]:9878", "http://[::1]:9878"],
  ])("takes a server on this computer (%s)", (value, expected) => {
    expect(feedbackApiBase(value)).toBe(expected);
  });

  it.each([
    "https://example.com/v3",
    "http://localhost.example.com/v3",
    "http://192.168.1.10:9878/v3",
    "file:///C:/feedback",
    "not a url",
  ])("ignores anything else, since the request carries the login (%s)", (value) => {
    expect(feedbackApiBase(value)).toBeUndefined();
  });
});
