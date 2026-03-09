import * as path from "node:path";
import { createConfig, bundle } from "../../../scripts/extensions-rolldown.mjs";

const extensionPath = path.resolve(import.meta.dirname);
const entryPoint = path.resolve(extensionPath, "src", "index.tsx");
const output = path.resolve(extensionPath, "dist", "index.js");

const config = createConfig(entryPoint, output);
await bundle(config);
