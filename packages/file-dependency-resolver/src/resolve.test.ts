import { describe, it } from "vitest";

import { resolve } from "./resolve";

describe("resolve", () => {
  // TODO: tests once the schema and implementation land (LAZ-552).
  it.todo("returns a stable result when all requirements are satisfied");
  it.todo("reports missing requirements with a download target");
  it.todo("surfaces clashes / pending choices as needsInput");

  void resolve;
});
