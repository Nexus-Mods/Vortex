import * as path from "node:path";

import { test } from "vitest";

import { discoverExtensions } from "./discovery";
import { createNexusClient } from "./nexusClient";
import { resolveFixtures } from "./resolveFixtures";
import { runOneFixture } from "./runOneFixture";

/**
 * Single test file that fans out to one `test.concurrent` per Nexus *file*
 * (every non-deleted, non-archived archive across every selected mod).
 *
 * The CLI sets GAME_EXT_TEST_REPO and GAME_EXT_TEST_GAMES; without those, the
 * file degrades to a single no-op test.
 */

const repoRoot = process.env.GAME_EXT_TEST_REPO;
const games = process.env.GAME_EXT_TEST_GAMES ?? "all";
const apiKey = process.env.NEXUS_API_KEY ?? "";

if (!repoRoot || !apiKey) {
  test("environment not configured (skipped)", () => {
    // The CLI sets these vars; ad-hoc `vitest run` outside the CLI skips here.
  });
} else {
  const requested = games === "all" ? null : games.split(",");
  const exts = discoverExtensions(repoRoot);
  const selected =
    requested === null
      ? exts
      : exts.filter(
          (e) =>
            requested.includes(e.packageName) ||
            requested.some((g) => e.packageDir.endsWith(`/${g}`)),
        );

  const client = createNexusClient(apiKey);
  for (const found of selected) {
    // @ts-ignore TS1378 — top-level await works under vitest's Vite transform.
    const descriptor = // @ts-ignore TS1378
      (await import(path.join(found.packageDir, "src", "test-descriptor.ts"))).testDescriptor;
    // @ts-ignore TS1378
    const fixtures = await resolveFixtures(client, descriptor);
    for (const fx of fixtures) {
      test.concurrent(`${descriptor.gameId} > modId=${fx.modId} fileId=${fx.fileId} (${fx.fileName})`, async (ctx) => {
        const skipReason = await runOneFixture({
          extensionDir: found.packageDir,
          fixture: fx,
        });
        if (skipReason) ctx.skip(skipReason);
      });
    }
  }
}
