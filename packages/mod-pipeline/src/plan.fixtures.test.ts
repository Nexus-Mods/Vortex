import { expect, test } from "vitest";

import { loadFixtures } from "./loadFixtures";
import { plan } from "./plan";
import { PlannerFixtureSchema } from "./plannerFixture";

const fixtures = loadFixtures("planner", PlannerFixtureSchema);

test("the planner fixtures are present", () => {
  expect(fixtures.length).toBeGreaterThan(0);
});

test.each(fixtures)("$name", (fixture) => {
  const operations = plan(fixture.current, fixture.previous, fixture.disk);

  expect(
    plan(
      structuredClone(fixture.current),
      structuredClone(fixture.previous),
      structuredClone(fixture.disk),
    ),
  ).toEqual(operations);
  expect(operations).toEqual(fixture.expected);
});
