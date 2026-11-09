import path from "node:path";

import { log } from "@/logging";
import type { IGameInfoEntry } from "@/types/IState";

export function openGameInfoValue(entry: IGameInfoEntry): void {
  const value = String(entry.value);

  if (entry.type === "path") {
    window.api.shell.openFile(value);
    return;
  }

  if (path.win32.isAbsolute(value)) {
    log("warn", 'Game info entry of type "url" holds a path, give it type "path"', {
      key: entry.key,
      provider: entry.provider,
    });
    window.api.shell.openFile(value);
    return;
  }

  window.api.shell.openUrl(value);
}
