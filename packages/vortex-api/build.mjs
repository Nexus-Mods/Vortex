import { cpSync, existsSync } from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..", "..");
const INPUT_DIR = path.join(ROOT_DIR, "src", "renderer", "lib");
const OUTPUT_DIR = path.join(import.meta.dirname, "lib");

if (!existsSync(INPUT_DIR)) {
  throw new Error(`Output directory doesn't exist: ${INPUT_DIR}`);
}

cpSync(INPUT_DIR, OUTPUT_DIR, { recursive: true });
