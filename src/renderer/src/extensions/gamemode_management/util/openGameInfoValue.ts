import { log } from "@/logging";
import type { IGameInfoEntry } from "@/types/IState";
import { isUrlTarget } from "@/util/is_url_target/isUrlTarget";

// Provider and key of each "url" entry already warned about, so repeated clicks log once.
const warnedEntries = new Set<string>();

export function openGameInfoValue(entry: IGameInfoEntry): void {
  // Same check util.opn used. Main drops an empty path but not "undefined" or "null",
  // which it would open relative to its working directory.
  if (!entry.value) {
    log("warn", "Game info entry has no value to open", {
      key: entry.key,
      provider: entry.provider,
    });
    return;
  }

  const value = String(entry.value);

  if (entry.type === "path") {
    window.api.shell.openFile(value);
    return;
  }

  // Same check util.opn used, so "url" entries holding a path keep working through the
  // deprecation window.
  if (!isUrlTarget(value)) {
    const warnKey = `${entry.provider}\u0000${entry.key}`;
    if (!warnedEntries.has(warnKey)) {
      warnedEntries.add(warnKey);
      log("warn", 'Game info entry of type "url" holds a path, give it type "path"', {
        key: entry.key,
        provider: entry.provider,
      });
    }
    window.api.shell.openFile(value);
    return;
  }

  window.api.shell.openUrl(value);
}
