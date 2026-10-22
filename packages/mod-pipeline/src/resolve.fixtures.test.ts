import { expect, test } from "vitest";

import { loadFixtures } from "./loadFixtures";
import { resolve } from "./resolve";
import { ResolverFixtureSchema } from "./resolverFixture";

const fixtures = loadFixtures("resolver", ResolverFixtureSchema);

test("the resolver fixtures are present", () => {
  expect(fixtures.length).toBeGreaterThan(0);
});

test.each(fixtures)("$name", (fixture) => {
  const lockfile = resolve(fixture.input);

  expect(resolve(structuredClone(fixture.input))).toEqual(lockfile);
  expect(lockfile).toEqual(fixture.expected);
});
