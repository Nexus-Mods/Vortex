import { getErrorMessageOrDefault } from "@vortex/shared";
import type { QualifiedPath } from "@vortex/shared/filesystem";

import { log } from "@/logging";

/** What a cached parse found: the file's parsed content, that the file is gone, or that
    it couldn't be read before anything was parsed from it. */
export type ParsedFile<T> =
  | { status: "parsed"; value: T }
  | { status: "missing" }
  | { status: "unreadable" };

/**
 * Parses files and remembers the results, reading a file again only when its size or
 * modified time changed, so checking an unchanged file costs one stat. A file that
 * can't be read keeps its last result: a store may hold its file open while writing it.
 */
export function cachedFileParser<T>(
  parse: (text: string) => T,
): (file: QualifiedPath) => Promise<ParsedFile<T>> {
  const reads = new Map<string, { size: number; modified: bigint; value: T }>();

  return async (file) => {
    const last = reads.get(file.value);
    try {
      const status = await window.api.fs.stat(file);
      if (!status.exists || !status.isFile) {
        reads.delete(file.value);
        return { status: "missing" };
      }
      const modified = status.modifiedTime.epochNanoseconds;
      if (last !== undefined && last.size === status.size && last.modified === modified) {
        return { status: "parsed", value: last.value };
      }
      // a write landing after the stat leaves a newer file than the one remembered,
      // so the next call reads it again
      const value = parse(new TextDecoder().decode(await window.api.fs.readFile(file)));
      reads.set(file.value, { size: status.size, modified, value });
      return { status: "parsed", value };
    } catch (err) {
      log("debug", "store install file unreadable", {
        path: file.value,
        error: getErrorMessageOrDefault(err),
      });
      return last !== undefined
        ? { status: "parsed", value: last.value }
        : { status: "unreadable" };
    }
  };
}
