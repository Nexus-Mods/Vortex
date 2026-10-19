import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { ResolverFixtureSchema, type ResolverFixture } from "./resolverFixture";

const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/resolver/", import.meta.url));

export interface ILoadedFixture {
  fileName: string;
  fixture: ResolverFixture;
}

function loadFixture(fileName: string): ILoadedFixture {
  const parsed = ResolverFixtureSchema.safeParse(
    JSON.parse(readFileSync(path.join(FIXTURE_DIR, fileName), "utf8")),
  );
  if (!parsed.success) {
    throw new Error(`${fileName} is not a resolver fixture: ${parsed.error.message}`);
  }
  return { fileName, fixture: parsed.data };
}

/** Every resolver fixture, in file name order. */
export function loadResolverFixtures(): ILoadedFixture[] {
  return readdirSync(FIXTURE_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .toSorted()
    .map(loadFixture);
}
