import { expect, test } from "vitest";

import { loadResolverFixtures } from "./loadFixtures";
import { resolve } from "./resolve";

const loaded = loadResolverFixtures();

test("the resolver fixtures are present", () => {
  expect(loaded.length).toBeGreaterThan(0);
});

test.each(loaded.map(({ fixture }) => [fixture.name, fixture] as const))("%s", (_name, fixture) => {
  const lockfile = resolve(fixture.state, fixture.gameFacts);

  expect(resolve(structuredClone(fixture.state), structuredClone(fixture.gameFacts))).toEqual(
    lockfile,
  );
  expect(lockfile).toEqual(fixture.expected);
});
