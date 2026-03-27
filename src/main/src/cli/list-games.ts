import * as path from "node:path";

import DuckDBSingleton from "../store/DuckDBSingleton";
import QueryRegistry from "../store/QueryRegistry";
import QueryInvalidator from "../store/QueryInvalidator";
import { parseAllQueries } from "../store/queryParser";

import { DiscoveryCoordinator } from "../games/DiscoveryCoordinator";
import { SteamScanner } from "../games/scanners/SteamScanner";
import { GOGScanner } from "../games/scanners/GOGScanner";
import { EpicScanner } from "../games/scanners/EpicScanner";
import { XboxScanner } from "../games/scanners/XboxScanner";
import { OriginScanner } from "../games/scanners/OriginScanner";
import { UplayScanner } from "../games/scanners/UplayScanner";
import { RegistryScanner } from "../games/scanners/RegistryScanner";

import { log } from "./logging";

interface StoreGameRow {
  store_type: string;
  store_id: string;
  install_path: string;
  name: string | null;
  store_metadata: string | null;
}

function formatTable(rows: StoreGameRow[]): string {
  if (rows.length === 0) {
    return "No games found.";
  }

  // Calculate column widths
  const headers = { store: "STORE", name: "NAME", path: "INSTALL PATH" };
  let storeW = headers.store.length;
  let nameW = headers.name.length;

  for (const row of rows) {
    storeW = Math.max(storeW, row.store_type.length);
    nameW = Math.max(nameW, (row.name ?? "").length);
  }

  const lines: string[] = [];
  lines.push(
    `${headers.store.padEnd(storeW)}  ${headers.name.padEnd(nameW)}  ${headers.path}`,
  );

  for (const row of rows) {
    const store = row.store_type.padEnd(storeW);
    const name = (row.name ?? "").padEnd(nameW);
    lines.push(`${store}  ${name}  ${row.install_path}`);
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  log("info", "cli: initializing DuckDB");
  const singleton = DuckDBSingleton.getInstance();
  await singleton.initialize();

  try {
    const connection = await singleton.createConnection();

    // Parse only store_games-related queries (skip tables.sql which needs LevelDB alias)
    const queriesDir = path.join(__dirname, "queries");
    const allQueries = parseAllQueries(queriesDir);
    const storeGameQueries = allQueries.filter((q) =>
      q.filePath.includes("store_games"),
    );

    const registry = new QueryRegistry(connection);
    await registry.initialize(storeGameQueries);

    const invalidator = new QueryInvalidator(registry);

    // Create scanners and coordinator
    const scanners = [
      new SteamScanner(),
      new GOGScanner(),
      new EpicScanner(),
      new XboxScanner(),
      new OriginScanner(),
      new UplayScanner(),
      new RegistryScanner(),
    ];

    const coordinator = new DiscoveryCoordinator(
      scanners,
      connection,
      invalidator,
    );

    log("info", "cli: running discovery");
    await coordinator.runDiscovery();

    // Query results
    const rows = (await registry.executeQuery(
      "all_store_games",
    )) as unknown as StoreGameRow[];

    // Print table to stdout
    console.log(formatTable(rows));
  } finally {
    singleton.close();
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
