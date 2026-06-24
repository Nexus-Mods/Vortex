import { shallowEqual } from "react-redux";

import type {
  CollectionModStatus,
  ICollectionModInstallInfo,
} from "../../../types/collections/ICollectionInstallSession";
import { modRuleId, reconstructModStatus } from "../../../util/collectionInstallSession";
import type { IDownload } from "../../download_management/types/IDownload";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { findDownloadByRef } from "../../mod_management/util/dependencies";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { renderModReference } from "../../mod_management/util/modName";
import { isDependencyRule } from "../../mod_management/util/testModReference";
import type { IProfileMod } from "../../profile_management/types/IProfile";

/**
 * One member mod of a collection as the CollectionPageView table renders it: the
 * installed mod (or a stub for one not yet downloaded), augmented with the rule that
 * pulled it in and its install `status`. Named "item" to distinguish it from a
 * mods-list entry whose mod happens to be a collection.
 *
 * This replaces the old in-component `modsEx` cache (IModEx). Display fields are
 * derived on demand from persistent state; `status` (a CollectionModStatus) is the
 * single source of truth for the install lifecycle and is the only status the UI
 * reads. The mod's own `ModState` is deliberately omitted: a row reports its state
 * through the collection-level `status`, not through the IMod contract.
 */
export type ICollectionItemRow = Omit<IMod, "state"> &
  IProfileMod & {
    collectionRule: IModRule;
    /** install status; always set (defaults to "pending" when nothing is known) */
    status: CollectionModStatus;
  };

// the display half of a row, before its status is resolved
type ItemRowData = Omit<ICollectionItemRow, "status">;

function rowFromDownload(dlId: string, download: IDownload, rule: IModRule): ItemRowData {
  const modId = download.modInfo?.meta?.details?.modId ?? download.modInfo?.nexus?.ids?.modId;

  return {
    id: dlId,
    type: "",
    installationPath: undefined,
    archiveId: dlId,
    enabledTime: 0,
    enabled: false,
    collectionRule: rule,
    attributes: {
      customFileName: download?.modInfo?.name,
      fileName: download.modInfo?.nexus?.fileInfo?.name ?? renderModReference(rule.reference),
      fileSize: download.size ?? rule.reference.fileSize,
      name: dlId,
      version: download.modInfo?.nexus?.fileInfo?.mod_version,
      author: download.modInfo?.nexus?.modInfo?.author,
      uploader: download.modInfo?.nexus?.modInfo?.user?.name,
      uploaderId: download.modInfo?.nexus?.modInfo?.user?.id,
      category: download.modInfo?.nexus?.modInfo?.category_id,
      source: download.modInfo?.nexus !== undefined ? "nexus" : undefined,
      id: modId,
      downloadGame: Array.isArray(download.game) ? download.game[0] : download.game,
    },
  };
}

// the display data plus the status derived purely from persistent redux state (used
// when no install session is tracking this mod); a mod's ModState and a download's
// state are both redux, mapped here into the collection's status vocabulary
// O(1) lookup indexes prebuilt once per rebuild (see buildCollectionItemRows), so a rule resolves
// its installed mod / download without the findModByRef/findDownloadByRef per-rule scan that
// dominated render time on large collections.
interface RowIndexes {
  // installed mod by referenceTag, and (backup) by content hash
  modByTag: Map<string, IMod>;
  modByMd5: Map<string, IMod>;
  // download id by referenceTag
  downloadIdByTag: Map<string, string>;
}

function persistentRow(
  rule: IModRule,
  // keyed by mod id
  mods: Record<string, IMod>,
  // keyed by download id
  downloads: Record<string, IDownload>,
  // keyed by mod id
  modState: Record<string, IProfileMod>,
  indexes: RowIndexes,
): { data: ItemRowData; status: CollectionModStatus } {
  // Match priority mirrors testModReference's exact-identity markers. A collection member's installed
  // mod and its download carry the rule's referenceTag (authoritative), and an installed mod is also
  // keyed by content hash (fileMD5) so a member whose tag drifted, or that was matched by hash rather
  // than tag, is still recognised - a hash match is the same file, so there are no false positives.
  // Only a rule carrying neither identity needs the full scan.
  const { tag, fileMD5 } = rule.reference;

  let mod = tag !== undefined ? indexes.modByTag.get(tag) : undefined;
  if (mod === undefined && fileMD5 !== undefined) {
    mod = indexes.modByMd5.get(fileMD5);
  }
  if (mod === undefined && tag === undefined && fileMD5 === undefined) {
    mod = findModByRef(rule.reference, mods);
  }
  if (mod !== undefined) {
    return {
      data: { ...mod, ...modState[mod.id], collectionRule: rule },
      status: reconstructModStatus(rule, mod, undefined),
    };
  }

  // downloads are stamped with the rule's referenceTag at download time (and reconciled on a
  // mismatch), so the tag is authoritative; only a tagless rule needs the scan.
  const dlId =
    tag !== undefined
      ? indexes.downloadIdByTag.get(tag)
      : findDownloadByRef(rule.reference, downloads);
  const download = dlId !== undefined ? downloads[dlId] : undefined;
  const data = download !== undefined ? rowFromDownload(dlId, download, rule) : stubRow(rule);

  return { data, status: reconstructModStatus(rule, undefined, download) };
}

// a stub built from the rule alone, for a mod that is neither installed nor downloaded
function stubRow(rule: IModRule): ItemRowData {
  return {
    // there is no mod or download id yet, so use the stable rule id (also the row's
    // map key) rather than the rendered name, which is not unique
    id: modRuleId(rule),
    type: "",
    installationPath: undefined,
    enabledTime: 0,
    enabled: false,
    collectionRule: rule,
    attributes: {
      fileSize: rule.reference.fileSize,
      ...(rule.extra || {}),
      // rule.extra.fileName is an actual file name; in mod attributes we expect the
      // name specified by the author
      fileName: rule.extra?.name,
    },
  };
}

/**
 * Build the table-row map for a collection's required+recommended mods, keyed by rule
 * id. Display data comes from persistent state; `status` is the live session status
 * when one is tracking this mod, otherwise derived from persistent state (pass an
 * empty `sessionMods` when no session is tracking this collection, e.g. when viewing
 * an already-installed collection).
 *
 * Pass the prior result as `previous` to keep unchanged rows referentially stable: an install
 * dispatch touches one member, so only its row gets a new reference and the table re-renders that
 * one row instead of all of them.
 */
export function buildCollectionItemRows(
  params: {
    rules: IModRule[];
    // keyed by mod id
    mods: Record<string, IMod>;
    // keyed by download id
    downloads: Record<string, IDownload>;
    // keyed by mod id
    modState: Record<string, IProfileMod>;
    // keyed by rule id
    sessionMods: Record<string, ICollectionModInstallInfo>;
  },
  previous?: Record<string, ICollectionItemRow>,
): Record<string, ICollectionItemRow> {
  const { rules, mods, downloads, modState, sessionMods } = params;
  // keyed by rule id
  const result: Record<string, ICollectionItemRow> = {};
  let changed = false;

  // Built once so each rule resolves its mod/download in O(1) instead of scanning every mod/download
  // (those per-rule scans dominated render time on large collections). Installed mods are keyed by
  // referenceTag and by content hash (fileMD5); downloads by referenceTag. First entry wins on the
  // (rare) duplicate, matching findModByRef's first-match.
  const indexes: RowIndexes = {
    modByTag: new Map<string, IMod>(),
    modByMd5: new Map<string, IMod>(),
    downloadIdByTag: new Map<string, string>(),
  };
  for (const mod of Object.values(mods)) {
    const tag = mod.attributes?.referenceTag;
    if (typeof tag === "string" && !indexes.modByTag.has(tag)) {
      indexes.modByTag.set(tag, mod);
    }
    const md5 = mod.attributes?.fileMD5;
    if (typeof md5 === "string" && !indexes.modByMd5.has(md5)) {
      indexes.modByMd5.set(md5, mod);
    }
  }
  for (const [dlId, download] of Object.entries(downloads)) {
    const tag = download.modInfo?.referenceTag;
    if (typeof tag === "string" && !indexes.downloadIdByTag.has(tag)) {
      indexes.downloadIdByTag.set(tag, dlId);
    }
  }

  (rules ?? []).filter(isDependencyRule).forEach((rule) => {
    const id = modRuleId(rule);
    const { data, status: persistentStatus } = persistentRow(
      rule,
      mods,
      downloads,
      modState ?? {},
      indexes,
    );

    // the session is the source of truth while it is tracking this mod
    const status = sessionMods?.[id]?.status ?? persistentStatus;

    const row = { ...data, status };
    // a row is `{ ...mod, ...modState, collectionRule, status }`; the immutable reducers reuse
    // the references of unchanged members, so an unchanged member is shallow-equal to its prior
    // row. Keep the prior reference then, so the table's per-row shouldComponentUpdate skips it.
    const prev = previous?.[id];
    if (prev !== undefined && shallowEqual(row, prev)) {
      result[id] = prev;
    } else {
      result[id] = row;
      changed = true;
    }
  });

  // nothing changed and no rule was added or removed -> hand back the previous map so an idle
  // dispatch does not even re-render the table container
  if (
    !changed &&
    previous !== undefined &&
    Object.keys(result).length === Object.keys(previous).length
  ) {
    return previous;
  }

  return result;
}
