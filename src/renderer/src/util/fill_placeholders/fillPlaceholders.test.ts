import { describe, expect, it } from "vitest";

import { fillPlaceholders } from "./fillPlaceholders";

describe("fillPlaceholders", () => {
  it("fills in placeholders with or without spaces", () => {
    expect(
      fillPlaceholders("Found {{ count }} games in {{dir}}", { count: 3, dir: "C:\\Games" }),
    ).toBe("Found 3 games in C:\\Games");
  });

  it("ignores a format after the name", () => {
    expect(fillPlaceholders("{{count, number}} mods", { count: 12 })).toBe("12 mods");
  });

  it("leaves a placeholder with no value as it is", () => {
    expect(fillPlaceholders("Wait {{ waitingTime }}", { count: 3 })).toBe("Wait {{ waitingTime }}");
  });

  it("leaves the text alone without replace", () => {
    expect(fillPlaceholders("Found {{ count }} games")).toBe("Found {{ count }} games");
  });
});
