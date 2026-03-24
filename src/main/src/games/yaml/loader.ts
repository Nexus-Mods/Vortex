import * as fs from "node:fs";
import * as path from "node:path";

import * as yaml from "js-yaml";

import { log } from "../../logging";
import type { AdaptorDocument } from "./types";

/**
 * Read and parse all `*.yaml` files in `dir`.
 * Invalid/unreadable files are skipped with a warning.
 */
export function loadYamlAdaptors(dir: string): AdaptorDocument[] {
  if (!fs.existsSync(dir)) {
    log("debug", "game-adaptors: yaml directory not found, skipping", { dir });
    return [];
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  if (files.length === 0) {
    log("debug", "game-adaptors: no yaml files found", { dir });
    return [];
  }

  const docs: AdaptorDocument[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const doc = yaml.load(raw) as AdaptorDocument;
      if (!doc?.game?.id || !doc?.rules) {
        log("warn", "game-adaptors: yaml missing required fields, skipping", {
          file,
        });
        continue;
      }
      docs.push(doc);
      log("debug", "game-adaptors: loaded adaptor", { id: doc.game.id, file });
    } catch (err) {
      log("warn", "game-adaptors: failed to parse yaml", {
        file,
        error: String(err),
      });
    }
  }

  return docs;
}
