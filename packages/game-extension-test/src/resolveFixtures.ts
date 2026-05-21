import type { INexusClient } from "./nexusClient";
import type { IFixture, IGameExtensionTestDescriptor } from "./types";
import { getErrorStatus } from "./util";

/** Mod-level row before per-file expansion. */
interface IModRef {
  origin: IFixture["origin"];
  modId: number;
}

/** File-level categories that we skip (Nexus's `category_name` values). */
const EXCLUDED_CATEGORIES = new Set(["DELETED", "ARCHIVED"]);

/** Filename extensions for which Nexus generates a content-preview JSON. */
const ARCHIVE_EXTENSIONS = [".zip", ".7z", ".rar", ".tar", ".tar.gz", ".tgz"];

/**
 * For each opted-in source in the descriptor, enumerate every non-deleted,
 * non-archived archive file for every selected mod. Returns one `IFixture` per
 * file (so a mod with five archive uploads becomes five fixtures).
 *
 * Parallelises the per-mod `listModFiles` calls via the client's built-in
 * rate-limiter (~25 req/s).
 */
export async function resolveFixtures(
  client: INexusClient,
  descriptor: IGameExtensionTestDescriptor,
): Promise<IFixture[]> {
  const seenMod = new Set<number>();
  const modRefs: IModRef[] = [];
  const tryAddMod = (r: IModRef) => {
    if (seenMod.has(r.modId)) return;
    seenMod.add(r.modId);
    modRefs.push(r);
  };

  const d = descriptor.nexusGameDomain;
  if (descriptor.fixtures.all) {
    for (const m of await client.listAllMods(d)) {
      tryAddMod({ origin: "all", modId: m.modId });
    }
  }
  if (descriptor.fixtures.mostPopular > 0) {
    for (const m of await client.listMostPopular(d, descriptor.fixtures.mostPopular)) {
      tryAddMod({ origin: "mostPopular", modId: m.modId });
    }
  }
  if (descriptor.fixtures.mostRecent > 0) {
    for (const m of await client.listMostRecent(d, descriptor.fixtures.mostRecent)) {
      tryAddMod({ origin: "mostRecent", modId: m.modId });
    }
  }
  if (descriptor.fixtures.oldest > 0) {
    for (const m of await client.listOldest(d, descriptor.fixtures.oldest)) {
      tryAddMod({ origin: "oldest", modId: m.modId });
    }
  }
  if (descriptor.fixtures.allCollections) {
    let cols: Awaited<ReturnType<INexusClient["listCollections"]>>;
    try {
      cols = await client.listCollections(d);
    } catch (err: unknown) {
      console.warn(
        `resolveFixtures: listCollections failed for ${d}; skipping collection fixtures. ` +
          (err instanceof Error ? err.message : String(err)),
      );
      cols = [];
    }
    for (const c of cols) {
      try {
        for (const m of await client.listCollectionMods(d, c.slug)) {
          tryAddMod({ origin: { type: "collection", collectionId: c.slug }, modId: m.modId });
        }
      } catch (err: unknown) {
        console.warn(
          `resolveFixtures: collection ${c.slug} failed; skipping. ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }
  }

  // Fan out: one listModFiles per mod, throttled by the client's rate-limiter.
  // Individual 403/404s (deleted/hidden mods) are swallowed; everything else
  // propagates and aborts the run.
  const perModFiles = await Promise.all(
    modRefs.map(async (ref) => {
      try {
        const files = await client.listModFiles(d, ref.modId);
        return { ref, files };
      } catch (err: unknown) {
        const status = getErrorStatus(err);
        if (status === 403 || status === 404) {
          return { ref, files: [] };
        }
        throw err;
      }
    }),
  );

  const out: IFixture[] = [];
  const seenFile = new Set<number>();
  for (const { ref, files } of perModFiles) {
    for (const f of files) {
      if (EXCLUDED_CATEGORIES.has(f.categoryName)) continue;
      if (!isArchiveFile(f.fileName)) continue;
      if (seenFile.has(f.fileId)) continue;
      seenFile.add(f.fileId);
      out.push({
        origin: ref.origin,
        modId: ref.modId,
        fileId: f.fileId,
        fileName: f.fileName,
        contentPreviewLink: f.contentPreviewLink,
      });
    }
  }
  return out;
}

function isArchiveFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
