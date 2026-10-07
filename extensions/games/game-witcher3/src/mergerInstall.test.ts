import { describe, expect, it } from "vitest";

import { extractionProblem } from "./mergerInstall";

describe("extractionProblem", () => {
  it("accepts a clean extraction", () => {
    expect(extractionProblem({ code: 0, errors: [] })).toBeUndefined();
  });

  it("accepts an extraction that only reported warnings", () => {
    expect(extractionProblem({ code: 1, errors: ["WARNING: something minor"] })).toBeUndefined();
  });

  it("names the error when 7-Zip failed", () => {
    const problem = extractionProblem({
      code: 2,
      errors: [
        "Cannot create output directory : Cannot create a file when that file already exists.",
      ],
    });
    expect(problem).toContain("Cannot create output directory");
  });

  it("reports the exit code when 7-Zip failed without a message", () => {
    expect(extractionProblem({ code: 7 })).toContain("7");
  });
});
