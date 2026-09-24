import { describe, expect, it } from "vitest";

import type { HealthCheckId } from "../../types";
import type { IHealthCheckContent } from "../../views/content/types";
import { groupByIssueType, type IListedEntry } from "./listedEntries";

const item = (id: string, checkId: HealthCheckId): IListedEntry => ({
  entry: { id, checkId, severity: "warning", resolutionType: "install", data: {} },
  content: {} as IHealthCheckContent,
  hidden: false,
});

describe("groupByIssueType", () => {
  it("puts warnings before suggestions, keeping each section's order", () => {
    const groups = groupByIssueType([
      item("s1", "check-nexus-mod-requirements"),
      item("w1", "check-file-level-requirements"),
      item("s2", "check-nexus-mod-requirements"),
    ]);

    expect(groups.map((g) => [g.issueType, g.items.map((i) => i.entry.id)])).toEqual([
      ["warning", ["w1"]],
      ["suggestion", ["s1", "s2"]],
    ]);
  });

  it("drops empty sections", () => {
    const groups = groupByIssueType([item("s1", "check-nexus-mod-requirements")]);

    expect(groups.map((g) => g.issueType)).toEqual(["suggestion"]);
  });
});
