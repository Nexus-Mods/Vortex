import * as path from "path";

import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";
import type { IParameters } from "@vortex/shared/cli";

import { log } from "../logging";
import { getApplication } from "./application";
import Debouncer from "./Debouncer";
import * as fs from "./fs";
import { writeFileAtomic } from "./fsAtomic";
import getVortexPath from "./getVortexPath";

const startupPath = () =>
  path.join(getVortexPath("appData"), getApplication().name, "startup.json");

const settings: IParameters = {};

export function readStartupSettings(): void {
  try {
    Object.assign(settings, JSON.parse(fs.readFileSync(startupPath(), { encoding: "utf-8" })));
  } catch (err) {
    const code = getErrorCode(err);
    if (code !== "ENOENT") {
      log("warn", "failed to parse startup.json", err);
    }
  }
}

const updateDebouncer = new Debouncer(() => {
  return writeFileAtomic(startupPath(), JSON.stringify(settings)).catch((err) => {
    log("error", "failed to write startup.json", {
      error: getErrorMessageOrDefault(err),
    });
  });
}, 100);

const proxy = new Proxy<IParameters>(settings, {
  set: (target: IParameters, key: string, value: any) => {
    target[key] = value;
    updateDebouncer.schedule();
    return true;
  },
});

export default proxy;
