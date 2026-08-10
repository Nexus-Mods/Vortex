import { describe, it, expect } from "vitest";

import { isPromiseLike } from "./guard";

const thenableFunc = function () {};
// oxlint-disable-next-line unicorn/no-thenable
thenableFunc.then = () => {};

describe("isPromiseLike", () => {
  it("should return true for Promise objects", () => {
    const promise = Promise.resolve(42);
    expect(isPromiseLike(promise)).toBe(true);
  });

  it("should return true for objects with a then method", () => {
    const thenable = {
      // oxlint-disable-next-line unicorn/no-thenable
      then: () => {},
    };
    expect(isPromiseLike(thenable)).toBe(true);
  });

  it("should return true for functions with a then method", () => {
    expect(isPromiseLike(thenableFunc)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isPromiseLike(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isPromiseLike(undefined)).toBe(false);
  });

  it("should return false for strings", () => {
    expect(isPromiseLike("string")).toBe(false);
  });

  it("should return false for numbers", () => {
    expect(isPromiseLike(42)).toBe(false);
  });

  it("should return false for booleans", () => {
    expect(isPromiseLike(true)).toBe(false);
    expect(isPromiseLike(false)).toBe(false);
  });

  it("should return false for symbols", () => {
    expect(isPromiseLike(Symbol("test"))).toBe(false);
  });

  it("should return false for objects without then method", () => {
    const obj = { foo: "bar" };
    expect(isPromiseLike(obj)).toBe(false);
  });

  it("should return false for objects where then is not a function", () => {
    // oxlint-disable-next-line unicorn/no-thenable
    const obj = { then: "not a function" };
    expect(isPromiseLike(obj)).toBe(false);
  });

  it("should return false for objects where then is null", () => {
    // oxlint-disable-next-line unicorn/no-thenable
    const obj = { then: null };
    expect(isPromiseLike(obj)).toBe(false);
  });

  it("should return false for empty objects", () => {
    expect(isPromiseLike({})).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isPromiseLike([])).toBe(false);
  });

  it("should work with generic type parameter", () => {
    const thenable: PromiseLike<string> = Promise.resolve("test");
    expect(isPromiseLike<string>(thenable)).toBe(true);
  });
});
