import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { z } from "./zodJitless";

/** Every fixture in `fixtures/<folder>`, in file name order. */
export function loadFixtures<T>(folder: "resolver" | "planner", schema: z.ZodType<T>): T[] {
  const fixtureDir = fileURLToPath(new URL(`../fixtures/${folder}/`, import.meta.url));
  return readdirSync(fixtureDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .toSorted()
    .map((fileName) => {
      const parsed = schema.safeParse(
        JSON.parse(readFileSync(path.join(fixtureDir, fileName), "utf8")),
      );
      if (!parsed.success) {
        throw new Error(`${fileName} is not a ${folder} fixture: ${parsed.error.message}`);
      }
      return parsed.data;
    });
}
