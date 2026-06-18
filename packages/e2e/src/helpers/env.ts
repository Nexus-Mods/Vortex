import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const E2E_ENV_FILE = path.join(E2E_ROOT, ".env");

let loaded = false;

export function loadE2EEnv(): void {
  if (loaded) return;
  loaded = true;

  if (!existsSync(E2E_ENV_FILE)) return;

  process.loadEnvFile(E2E_ENV_FILE);
}
