import * as path from "node:path";

import { createConfig, bundle } from "../../scripts/extensions-rolldown.mjs";

const extensionPath = path.resolve(import.meta.dirname);
const entryPoint = path.resolve(extensionPath, "src", "index.ts");
const output = path.resolve(extensionPath, "dist", "index.cjs");

const config = createConfig(entryPoint, output);

config.external.push("turbowalk", "libxmljs");

await bundle(config);
