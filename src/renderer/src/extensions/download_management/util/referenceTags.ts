/**
 * Recording collection-rule tags on a download. One archive can satisfy rules in several
 * collections, so the tag set is append-only: `modInfo.referenceTag` keeps the first tag stamped
 * (older Vortex versions read only that field) and `modInfo.referenceTags` carries all of them.
 *
 * The read side lives with the rest of the identity matching (testModReference).
 */
import type { Action } from "redux";

import { downloadReferenceTags } from "../../mod_management/util/testModReference";
import { setDownloadModInfo } from "../actions/state";
import type { IDownload } from "../types/IDownload";

/**
 * Actions recording `tag` on the download's tag set. Writes the whole unioned array in one action
 * (the reducer sets a dotted path, so a merge would combine arrays by index), and sets the legacy
 * single field only when the archive carries no tag yet. Empty when the tag is already recorded.
 */
export function appendReferenceTagActions(
  downloadId: string,
  download: IDownload | undefined,
  tag: string,
): Action[] {
  const tags = downloadReferenceTags(download);
  if (tags.includes(tag)) {
    return [];
  }
  const actions: Action[] = [
    setDownloadModInfo(downloadId, "referenceTags", [...tags, tag]),
  ] as Action[];
  if (download?.modInfo?.referenceTag === undefined) {
    actions.push(setDownloadModInfo(downloadId, "referenceTag", tag) as Action);
  }
  return actions;
}
