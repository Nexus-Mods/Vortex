import { describe, it } from "vitest";

import { checkFileLevelRequirements } from "./checkFileLevelRequirements";

describe("checkFileLevelRequirements", () => {
  it.todo("reports a requirement as satisfied when an acceptable file is installed");
  it.todo("reports a missing requirement with its download target");
  it.todo("reports multiple acceptable targets as a choice, without picking one");
  it.todo("flags external / DLC requirements as informational-only");

  void checkFileLevelRequirements;
});
