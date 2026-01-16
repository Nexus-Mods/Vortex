#!/usr/bin/env node

/**
 * GameFinder CLI - Detect games installed on the system
 *
 * Usage: yarn detect-games [--store <store>] [--json]
 *
 * Options:
 *   --store <store>  Only search a specific store (steam, gog, epic, xbox)
 *   --json           Output results as JSON
 */

const path = require("path");

// Import from compiled output
const outDir = path.join(__dirname, "..", "out");

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const storeIndex = args.indexOf("--store");
  const specificStore = storeIndex !== -1 ? args[storeIndex + 1] : null;

  // Dynamically import handlers from compiled output
  let SteamHandler, GOGHandler, EpicHandler, XboxHandler;

  try {
    const steam = require(path.join(outDir, "extensions", "gamefinder", "store-handlers", "steam"));
    const gog = require(path.join(outDir, "extensions", "gamefinder", "store-handlers", "gog"));
    const epic = require(path.join(outDir, "extensions", "gamefinder", "store-handlers", "epic"));
    const xbox = require(path.join(outDir, "extensions", "gamefinder", "store-handlers", "xbox"));

    SteamHandler = steam.SteamHandler;
    GOGHandler = gog.GOGHandler;
    EpicHandler = epic.EpicHandler;
    XboxHandler = xbox.XboxHandler;
  } catch (err) {
    console.error("Error: Could not load GameFinder handlers.");
    console.error("Make sure you have run 'yarn build' first.");
    console.error("");
    console.error("Details:", err.message);
    process.exit(1);
  }

  const handlers = {
    steam: () => new SteamHandler(),
    gog: () => new GOGHandler(),
    epic: () => new EpicHandler(),
    xbox: () => new XboxHandler(),
  };

  const stores = specificStore ? [specificStore] : ["steam", "gog", "epic", "xbox"];

  // Validate store name
  if (specificStore && !handlers[specificStore]) {
    console.error(`Unknown store: ${specificStore}`);
    console.error("Valid stores: steam, gog, epic, xbox");
    process.exit(1);
  }

  const results = {
    games: [],
    errors: [],
    skipped: [],
  };

  if (!jsonOutput) {
    console.log("GameFinder - Detecting installed games...\n");
  }

  for (const storeName of stores) {
    const handler = handlers[storeName]();

    try {
      const isAvailable = await handler.isAvailable();
      if (!isAvailable) {
        results.skipped.push(storeName);
        if (!jsonOutput) {
          console.log(`${handler.storeName}: Not available on this system`);
        }
        continue;
      }

      const result = await handler.findAllGames();

      if (result.isErr()) {
        results.errors.push({
          store: storeName,
          error: result.error,
        });
        if (!jsonOutput) {
          console.log(`${handler.storeName}: Error - ${result.error.message}`);
        }
        continue;
      }

      const games = result.value;
      results.games.push(
        ...games.map((game) => ({
          ...game,
          store: storeName,
        }))
      );

      if (!jsonOutput) {
        console.log(`${handler.storeName}: Found ${games.length} game(s)`);
        for (const game of games) {
          console.log(`  - ${game.name} (${game.id})`);
          console.log(`    Path: ${game.path}`);
        }
        console.log("");
      }
    } catch (err) {
      results.errors.push({
        store: storeName,
        error: {
          code: "UNKNOWN_ERROR",
          message: err.message || String(err),
        },
      });
      if (!jsonOutput) {
        console.log(`${handler.storeName}: Unexpected error - ${err.message}`);
      }
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("---");
    console.log(`Total: ${results.games.length} game(s) detected`);
    if (results.skipped.length > 0) {
      console.log(`Skipped: ${results.skipped.join(", ")}`);
    }
    if (results.errors.length > 0) {
      console.log(`Errors: ${results.errors.length}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
