import { describe, it, expect, vi } from "vitest";

import type { IStateVerifier } from "../types/IExtensionContext";
import { VerifierDrop, VerifierDropParent } from "../types/IExtensionContext";
import { verify, verifyElement } from "./verify";

const desc = (msg: string) => () => msg;
const emitSpy = () => vi.fn<(d: string) => void>();

describe("verifyElement", () => {
  describe("type checking", () => {
    it("accepts a value matching the declared type", () => {
      expect(verifyElement({ description: desc(""), type: "string" }, "hi")).toBe(true);
      expect(verifyElement({ description: desc(""), type: "number" }, 42)).toBe(true);
      expect(verifyElement({ description: desc(""), type: "boolean" }, true)).toBe(true);
      expect(verifyElement({ description: desc(""), type: "array" }, [1])).toBe(true);
      expect(verifyElement({ description: desc(""), type: "object" }, { a: 1 })).toBe(true);
    });

    it("rejects a value that does not match the declared type", () => {
      expect(verifyElement({ description: desc(""), type: "string" }, 123)).toBe(false);
      expect(verifyElement({ description: desc(""), type: "number" }, "hi")).toBe(false);
      expect(verifyElement({ description: desc(""), type: "array" }, "not array")).toBe(false);
      expect(verifyElement({ description: desc(""), type: "object" }, 42)).toBe(false);
    });

    it("skips type check when value is undefined and not required", () => {
      expect(verifyElement({ description: desc(""), type: "string" }, undefined)).toBe(true);
    });

    it("fails type check when value is undefined but required", () => {
      expect(
        verifyElement({ description: desc(""), type: "string", required: true }, undefined),
      ).toBe(false);
    });
  });

  describe("noUndefined", () => {
    it("rejects undefined", () => {
      expect(verifyElement({ description: desc(""), noUndefined: true }, undefined)).toBe(false);
    });

    it("accepts a defined value", () => {
      expect(verifyElement({ description: desc(""), noUndefined: true }, "ok")).toBe(true);
    });
  });

  describe("noNull", () => {
    it("rejects null", () => {
      expect(verifyElement({ description: desc(""), noNull: true }, null)).toBe(false);
    });

    it("accepts non-null", () => {
      expect(verifyElement({ description: desc(""), noNull: true }, 0)).toBe(true);
    });
  });

  describe("noEmpty", () => {
    it("rejects empty array", () => {
      expect(verifyElement({ description: desc(""), type: "array", noEmpty: true }, [])).toBe(
        false,
      );
    });

    it("rejects empty object", () => {
      expect(verifyElement({ description: desc(""), type: "object", noEmpty: true }, {})).toBe(
        false,
      );
    });

    it("rejects empty string", () => {
      expect(verifyElement({ description: desc(""), type: "string", noEmpty: true }, "")).toBe(
        false,
      );
    });

    it("accepts non-empty values", () => {
      expect(verifyElement({ description: desc(""), type: "array", noEmpty: true }, [1])).toBe(
        true,
      );
      expect(
        verifyElement({ description: desc(""), type: "object", noEmpty: true }, { a: 1 }),
      ).toBe(true);
      expect(verifyElement({ description: desc(""), type: "string", noEmpty: true }, "x")).toBe(
        true,
      );
    });
  });

  it("passes when no constraints are set", () => {
    expect(verifyElement({ description: desc("") }, "anything")).toBe(true);
    expect(verifyElement({ description: desc("") }, undefined)).toBe(true);
    expect(verifyElement({ description: desc("") }, null)).toBe(true);
  });
});

describe("verify", () => {
  it("returns input unchanged when verifiers is undefined", () => {
    const input = { foo: "bar" };
    expect(verify("test", undefined, input, {}, emitSpy())).toBe(input);
  });

  it("returns undefined when input is undefined", () => {
    const verifiers: Record<string, IStateVerifier> = {
      foo: { description: desc("bad"), type: "string" },
    };
    expect(verify("test", verifiers, undefined, {}, emitSpy())).toBeUndefined();
  });

  it("returns input by reference when everything is valid", () => {
    const input = { name: "hello" };
    const verifiers: Record<string, IStateVerifier> = {
      name: { description: desc("bad"), type: "string" },
    };
    expect(verify("test", verifiers, input, {}, emitSpy())).toBe(input);
  });

  it("replaces invalid value with default when no repair or deleteBroken", () => {
    const input = { count: "not a number" };
    const verifiers: Record<string, IStateVerifier> = {
      count: { description: desc("bad count"), type: "number" },
    };
    const defaults = { count: 0 };
    const emit = emitSpy();

    const result = verify("test", verifiers, input, defaults, emit);

    expect(result).toEqual({ count: 0 });
    expect(emit).toHaveBeenCalledWith("bad count");
  });

  it("deletes the broken key when deleteBroken is true", () => {
    const input = { a: "ok", b: 123 };
    const verifiers: Record<string, IStateVerifier> = {
      b: { description: desc("bad b"), type: "string", deleteBroken: true },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result).toEqual({ a: "ok" });
    expect(result).not.toHaveProperty("b");
  });

  it("returns undefined when deleteBroken is 'parent'", () => {
    const input = { a: "ok", b: 123 };
    const verifiers: Record<string, IStateVerifier> = {
      b: { description: desc("bad b"), type: "string", deleteBroken: "parent" },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result).toBeUndefined();
  });

  it("uses repair function to fix a broken value", () => {
    const input = { game: "skyrim" };
    const verifiers: Record<string, IStateVerifier> = {
      game: {
        description: desc("game should be array"),
        type: "array",
        repair: (val) => [val],
      },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result).toEqual({ game: ["skyrim"] });
  });

  it("deletes key when repair throws VerifierDrop", () => {
    const input = { broken: "x" };
    const verifiers: Record<string, IStateVerifier> = {
      broken: {
        description: desc("bad"),
        type: "number",
        repair: () => {
          throw new VerifierDrop();
        },
      },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result).toEqual({});
  });

  it("returns undefined when repair throws VerifierDropParent", () => {
    const input = { broken: "x" };
    const verifiers: Record<string, IStateVerifier> = {
      broken: {
        description: desc("bad"),
        type: "number",
        repair: () => {
          throw new VerifierDropParent();
        },
      },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result).toBeUndefined();
  });

  it("applies wildcard verifier to every key in the object", () => {
    const input = {
      dl1: { game: ["skyrim"] },
      dl2: { game: "fallout4" },
      dl3: { game: ["oblivion"] },
    };
    const verifiers: Record<string, IStateVerifier> = {
      _: {
        description: desc("bad download"),
        elements: {
          game: {
            description: desc("game should be array"),
            type: "array",
            repair: (val) => (val !== undefined ? [val] : val),
          },
        },
      },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result.dl1.game).toEqual(["skyrim"]);
    expect(result.dl2.game).toEqual(["fallout4"]);
    expect(result.dl3.game).toEqual(["oblivion"]);
  });

  it("recurses into nested elements", () => {
    const input = {
      settings: { theme: 42 },
    };
    const verifiers: Record<string, IStateVerifier> = {
      settings: {
        description: desc("bad settings"),
        elements: {
          theme: { description: desc("bad theme"), type: "string" },
        },
      },
    };
    const defaults = {};

    const result = verify("test", verifiers, input, defaults, emitSpy());

    expect(result.settings.theme).toBeUndefined();
  });

  it("removes a nested element via wildcard + VerifierDropParent", () => {
    const input = {
      dl1: { game: ["skyrim"] },
      dl2: { game: undefined },
    };
    const verifiers: Record<string, IStateVerifier> = {
      _: {
        description: desc("bad download"),
        elements: {
          game: {
            description: desc("game required"),
            type: "array",
            required: true,
            repair: (val) => {
              if (val !== undefined) {
                return [val];
              }
              throw new VerifierDropParent();
            },
          },
        },
      },
    };

    const result = verify("test", verifiers, input, {}, emitSpy());

    expect(result.dl1).toEqual({ game: ["skyrim"] });
    expect(result).not.toHaveProperty("dl2");
  });

  it("emits descriptions for each broken field", () => {
    const input = { a: "wrong", b: "also wrong" };
    const verifiers: Record<string, IStateVerifier> = {
      a: { description: desc("a is bad"), type: "number" },
      b: { description: desc("b is bad"), type: "number" },
    };
    const emit = emitSpy();

    verify("test", verifiers, input, { a: 0, b: 0 }, emit);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith("a is bad");
    expect(emit).toHaveBeenCalledWith("b is bad");
  });

  it("calls log callback for invalid state", () => {
    const input = { x: "wrong" };
    const verifiers: Record<string, IStateVerifier> = {
      x: { description: desc("x bad"), type: "number" },
    };
    const logSpy = vi.fn();

    verify("mypath", verifiers, input, { x: 0 }, emitSpy(), logSpy);

    expect(logSpy).toHaveBeenCalledWith(
      "warn",
      "invalid state",
      expect.objectContaining({ statePath: "mypath", key: "x" }),
    );
  });

  it("replaces missing required field with default", () => {
    const input = { other: "val" };
    const verifiers: Record<string, IStateVerifier> = {
      name: { description: desc("name required"), type: "string", required: true },
    };

    const result = verify("test", verifiers, input, { name: "default" }, emitSpy());

    expect(result.name).toBe("default");
  });

  it("does not mutate the original input", () => {
    const input = Object.freeze({ count: "bad", keep: "ok" });
    const verifiers: Record<string, IStateVerifier> = {
      count: { description: desc("bad"), type: "number" },
    };

    const result = verify("test", verifiers, input, { count: 0 }, emitSpy());

    expect(result).toEqual({ count: 0, keep: "ok" });
    expect(input).toEqual({ count: "bad", keep: "ok" });
  });
});
