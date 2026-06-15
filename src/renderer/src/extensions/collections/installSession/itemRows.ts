import type { IDownload } from "../../download_management/types/IDownload";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { findDownloadByRef } from "../../mod_management/util/dependencies";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { renderModReference } from "../../mod_management/util/modName";
import type { IProfileMod } from "../../profile_management/types/IProfile";
import type { CollectionModStatus, ICollectionModInstallInfo } from "./types";
import { modRuleId, reconstructModStatus } from "./util";

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
    /** download progress (0-1) while downloading; undefined otherwise */
    progress?: number;
    /** install status; always set (defaults to "pending" when nothing is known) */
    status: CollectionModStatus;
  };

// the display half of a row, before its status is resolved
type ItemRowData = Omit<ICollectionItemRow, "status">;

function rowFromDownload(dlId: string, download: IDownload, rule: IModRule): ItemRowData {
  const modId = download.modInfo?.meta?.details?.modId ?? download.modInfo?.nexus?.ids?.modId;
  const downloading = download.state !== "finished";

  return {
    id: dlId,
    type: "",
    installationPath: undefined,
    archiveId: dlId,
    enabledTime: 0,
    enabled: false,
    collectionRule: rule,
    progress: downloading && download.size ? download.received / download.size : undefined,
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
function persistentRow(
  rule: IModRule,
  // keyed by mod id
  mods: Record<string, IMod>,
  // keyed by download id
  downloads: Record<string, IDownload>,
  // keyed by mod id
  modState: Record<string, IProfileMod>,
): { data: ItemRowData; status: CollectionModStatus } {
  const mod = findModByRef(rule.reference, mods);
  if (mod !== undefined) {
    return {
      data: { ...mod, ...modState[mod.id], collectionRule: rule },
      status: reconstructModStatus(rule, mod, undefined),
    };
  }

  const dlId = findDownloadByRef(rule.reference, downloads);
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
 */
export function buildCollectionItemRows(params: {
  rules: IModRule[];
  // keyed by mod id
  mods: Record<string, IMod>;
  // keyed by download id
  downloads: Record<string, IDownload>;
  // keyed by mod id
  modState: Record<string, IProfileMod>;
  // keyed by rule id
  sessionMods: Record<string, ICollectionModInstallInfo>;
}): Record<string, ICollectionItemRow> {
  const { rules, mods, downloads, modState, sessionMods } = params;
  // keyed by rule id
  const result: Record<string, ICollectionItemRow> = {};

  (rules ?? [])
    .filter((rule) => rule.type === "requires" || rule.type === "recommends")
    .forEach((rule) => {
      const id = modRuleId(rule);
      const { data, status: persistentStatus } = persistentRow(
        rule,
        mods,
        downloads,
        modState ?? {},
      );

      // the session is the source of truth while it is tracking this mod
      const status = sessionMods?.[id]?.status ?? persistentStatus;

      result[id] = { ...data, status };
    });

  return result;
}
