import { loadExtension } from "./loadExtension";
import { FileManifestHttpError, fetchFileManifest } from "./manifest";
import { runFixture } from "./runFixture";
import type { IFixture } from "./types";

/**
 * Run a single pre-resolved fixture: fetch the manifest, drive the installer,
 * run the diagnostic.
 *
 * Returns a skip reason string when something genuinely couldn't be tested
 * (manifest missing on the CDN). Throws on real failures, including the
 * installer rejecting the file — rejection means "no installer handler
 * registered for this file type" and is a signal we need to address, not hide.
 */
export async function runOneFixture(args: {
  extensionDir: string;
  fixture: IFixture;
}): Promise<string | undefined> {
  if (!args.fixture.contentPreviewLink) {
    return `no content_preview_link for fileId=${args.fixture.fileId}`;
  }

  let manifest: string[];
  try {
    manifest = await fetchFileManifest(args.fixture.contentPreviewLink);
  } catch (err: unknown) {
    if (err instanceof FileManifestHttpError && err.status === 404) {
      return `manifest not on CDN: ${err.message}`;
    }
    throw err;
  }

  const ext = await loadExtension(args.extensionDir);

  const skipHeuristics = ext.testDescriptor.skipHeuristics ?? [];
  for (const h of skipHeuristics) {
    if (h.matches(manifest)) {
      return `skipped by heuristic: ${h.reason}`;
    }
  }

  const outcome = await runFixture(ext, args.fixture, manifest);
  if (outcome.kind === "failed") {
    throw new Error(outcome.issues.join("; "));
  }
  if (outcome.kind === "rejected") {
    throw new Error(
      `[${ext.gameId}] installer rejected file ${args.fixture.fileName} (modId=${args.fixture.modId}, fileId=${args.fixture.fileId}). ` +
        `If this is intentional, add a more specific installer that supports this file shape; ` +
        `otherwise an existing installer's testSupported needs to accept it.`,
    );
  }
  return undefined;
}
