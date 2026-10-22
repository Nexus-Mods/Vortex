import { expect, test } from "vitest";

import { loadResolverFixtures } from "./loadFixtures";
import { resolve } from "./resolve";

const fixtures = loadResolverFixtures();

test("the resolver fixtures are present", () => {
  expect(fixtures.length).toBeGreaterThan(0);
});

test.each(fixtures)("$name", (fixture) => {
  const lockfile = resolve(fixture.input);

  expect(resolve(structuredClone(fixture.input))).toEqual(lockfile);
  expect(lockfile).toEqual(fixture.expected);
});
