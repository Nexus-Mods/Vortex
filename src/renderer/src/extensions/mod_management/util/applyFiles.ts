import type { ApplyFiles } from "@nexusmods/mod-pipeline";
import { VortexError } from "@vortex/shared";
import { QualifiedPath, type FileSystem } from "@vortex/shared/filesystem";

import { entryIdOf } from "./diskScan";

const qualified = (path: string) => QualifiedPath.fromNative(path);

/** Apply's file work through FileSystem, on hardlinks. */
export function applyFilesOn(fs: FileSystem): ApplyFiles {
  const statusAt = (path: string) => fs.stat(qualified(path), { parseSymLink: true });

  return {
    idAt: async (path) => {
      const status = await statusAt(path);
      return status.exists ? entryIdOf(status) : undefined;
    },
    move: async (from, to) => {
      const [source, targetFolder] = await Promise.all([
        statusAt(from),
        statusAt(qualified(to).parent().path),
      ]);
      // FileSystem.move copies across drives, which a kill can leave half done
      if (source.exists && targetFolder.exists && source.deviceId !== targetFolder.deviceId) {
        throw new VortexError(`${to} is on another drive than ${from}`, {
          kind: "os:generic",
          originalCode: "EXDEV",
        });
      }
      await fs.move(qualified(from), qualified(to));
    },
    link: (from, to) => fs.createLink(qualified(from), qualified(to), "hardlink"),
    remove: (path) => fs.delete(qualified(path)),
    createFolder: (path) => fs.createDirectory(qualified(path)),
    removeEmptyFolder: async (path) => {
      const status = await statusAt(path);
      if (!status.exists || status.isFile) {
        return;
      }
      const folder = qualified(path);
      const listing = await fs.enumerateDirectory(folder);
      const { done } = await listing.next();
      await listing.return?.();
      if (done === true) {
        await fs.deleteRecursive(folder);
      }
    },
  };
}
