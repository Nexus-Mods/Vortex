import { describe, expect, it, vi } from "vitest";

vi.mock("../modSource", () => ({
  getModSources: () => [
    { id: "nexus", name: "Nexus Mods" },
    { id: "hidden", name: "Hidden", options: { condition: () => false } },
    { id: "website", name: "Website", options: { condition: () => true } },
  ],
}));

import { availableModSources } from "./availableModSources";

describe("availableModSources", () => {
  it("offers every source whose condition holds, or that has none", () => {
    expect(availableModSources().map(({ id }) => id)).toEqual(["nexus", "website"]);
  });
});
