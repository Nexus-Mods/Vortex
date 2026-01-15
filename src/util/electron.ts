import { createRequire } from "module";
import type * as remoteT from "@electron/remote";
import * as electron from "electron";

const require = createRequire(import.meta.url);

const myExport: typeof electron & { remote?: typeof remoteT } = {
  ...electron,
};

export default myExport;

if (process.type === "renderer") {
  myExport.remote = require("@electron/remote");
}
