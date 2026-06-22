import * as path from "node:path";

import { buildGdlExtension } from "../../../scripts/build-gdl-extension.mjs";

// This extension is described declaratively in game.yaml and compiled by the
// Game Description Language (GDL) toolchain (the game-description-language
// submodule) into a Vortex-loadable dist/index.js.
await buildGdlExtension(path.resolve(import.meta.dirname));
