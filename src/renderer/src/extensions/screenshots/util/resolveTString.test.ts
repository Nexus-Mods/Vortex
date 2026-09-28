/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";

import { TString } from "@/util/i18n";

import { resolveTString } from "./resolveTString";

const { t } = vi.hoisted(() => {
  return {
    t: vi.fn((_key: string, _options?: any): string => ""),
  };
});

describe("resolveTString", () => {
  it("resolves undefined to an empty string", () => {
    const result = resolveTString(t, undefined);

    expect(result).toBe("");
    expect(t).not.toHaveBeenCalled();
  });

  it("resolves a string to the input string", () => {
    const result = resolveTString(t, "Example");

    expect(result).toBe("Example");
    expect(t).not.toHaveBeenCalled();
  });

  it("resolves a TString to the localised output", () => {
    const input = new TString("example::string", {}, "test");

    t.mockReturnValue("Example translated string");

    const result = resolveTString(t, input);

    expect(result).toBe("Example translated string");
    expect(t).toHaveBeenCalledWith("example::string", { ns: "test" });
  });
});
