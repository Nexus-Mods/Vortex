import { describe, expect, it } from "vitest";

import { summarizeCyberpunkDiagnostics } from "./diagnosticSummary";

describe("summarizeCyberpunkDiagnostics", () => {
  it("groups diagnostics by cyberpunk-relevant categories", () => {
    const summary = summarizeCyberpunkDiagnostics([
      {
        id: "conflict",
        level: "warning",
        kind: "conflict",
        title: "Conflict",
        message: "Conflict detected",
      },
      {
        id: "parser",
        level: "warning",
        kind: "parser",
        title: "Parser",
        message: "Parser issue",
      },
      {
        id: "dependency",
        level: "warning",
        kind: "missing-dependency",
        title: "Dependency",
        message: "Missing dependency",
      },
      {
        id: "other",
        level: "info",
        kind: "guidance",
        title: "Guidance",
        message: "Some note",
      },
    ]);

    expect(summary).toEqual({
      total: 4,
      conflicts: 1,
      parser: 1,
      dependencies: 1,
      other: 1,
    });
  });
});
