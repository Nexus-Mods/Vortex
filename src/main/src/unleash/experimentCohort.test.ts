import { describe, expect, it } from "vitest";

import { experimentCohortHash } from "./experimentCohort";

const INSTANCE_ID = "3f2b8c1e-4d5a-4f6b-9c7d-8e9f0a1b2c3d";

describe("experimentCohortHash", () => {
  it("gives the same install the same hash every time", () => {
    expect(experimentCohortHash(INSTANCE_ID)).toBe(experimentCohortHash(INSTANCE_ID));
  });

  it("gives different installs different hashes", () => {
    expect(experimentCohortHash(INSTANCE_ID)).not.toBe(
      experimentCohortHash("00000000-0000-4000-8000-000000000000"),
    );
  });

  it("never contains the instance ID itself", () => {
    const hash = experimentCohortHash(INSTANCE_ID);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(INSTANCE_ID);
  });
});
