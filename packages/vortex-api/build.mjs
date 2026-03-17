import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..", "..");
const INPUT_DIR = path.join(ROOT_DIR, "src", "renderer", "lib");
const OUTPUT_DIR = path.join(import.meta.dirname, "lib");

const API_PACKAGE_FILE = path.join(import.meta.dirname, "package.json");
const MAIN_PACKAGE_FILE = path.join(ROOT_DIR, "src", "main", "package.json");

if (!existsSync(INPUT_DIR)) {
  throw new Error(`Output directory doesn't exist: ${INPUT_DIR}`);
}

cpSync(INPUT_DIR, OUTPUT_DIR, { recursive: true });

const apiPackage = JSON.parse(readFileSync(API_PACKAGE_FILE, "utf8"));
const mainPackage = JSON.parse(readFileSync(MAIN_PACKAGE_FILE, "utf8"));

const apiPeerDependencies = new Set(Object.keys(apiPackage.peerDependencies));
const mainDependencies = new Set(Object.keys(mainPackage.dependencies));

const toRemove = [];

for (const peerDependency of apiPeerDependencies) {
  if (mainDependencies.has(peerDependency)) continue;
  toRemove.push(peerDependency);
}

if (toRemove.length > 0) {
  console.log(
    `Removing ${toRemove.length} peer dependencies from the API package`,
  );

  for (const packageName of toRemove) {
    delete apiPackage.peerDependencies[packageName];
  }
}

const json = JSON.stringify(apiPackage, null, 2);
writeFileSync(API_PACKAGE_FILE, json + "\n");
