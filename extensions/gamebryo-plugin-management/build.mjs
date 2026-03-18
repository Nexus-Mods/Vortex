import * as path from "node:path";
import { createConfig, bundle, nativeRemapPlugin } from "../../scripts/extensions-rolldown.mjs";

const extensionPath = path.resolve(import.meta.dirname);
const entryPoint = path.resolve(extensionPath, "src", "index.ts");
const output = path.resolve(extensionPath, "dist", "index.cjs");

const remapPlugin = nativeRemapPlugin({
  "./build/Release/node-loot": "./node-loot.node",
  "./build/Release/esptk": "./esptk.node",
});

const config = createConfig(entryPoint, output, [remapPlugin]);
await bundle(config);

