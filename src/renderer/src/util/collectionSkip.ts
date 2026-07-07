import { updateModStatus } from "../actions/collectionInstallTracking";
import { addModRule } from "../extensions/mod_management/actions/mods";
import type { IModReference } from "../extensions/mod_management/types/IMod";
import { isFuzzyVersion } from "../extensions/mod_management/util/isFuzzyVersion";
import {
  isDependencyRule,
  testRefByIdentifiers,
  type IReferenceIdentifiers,
} from "../extensions/mod_management/util/testModReference";
import { log } from "../logging";
import type { IExtensionApi } from "../types/IExtensionContext";
import { modRuleId } from "./collectionInstallSession";
import { getCollectionActiveSession } from "./collectionInstallSessionSelectors";
import { batchDispatch } from "./util";

/**
 * The identity of a download a free user skipped, as Nexus knows it: the mod page (modId), the
 * skipped file (fileId) and the update-chain file ids / names around it. Any field may be
 * absent depending on how the skip was reached. This is the reference-matching identifier shape
 * (without the internal `condition` predicate testRefByIdentifiers accepts).
 */
export type ISkippedDownloadIdentifiers = Omit<IReferenceIdentifiers, "condition">;

/**
 * How a skipped collection member was identified. A premium/automatic skip (InstallManager)
 * has the dependency's full mod reference; a free-user skip (nexus_integration) only has the
 * loose Nexus identifiers of the file. Both resolve to the same outcome - mark the member
 * ignored - so they share one entry point.
 */
export type ICollectionSkip =
  | { reference: IModReference }
  | { identifiers: ISkippedDownloadIdentifiers };

const sanitizeFileName = (fileName: string): string =>
  fileName.toLowerCase().replace(/[^a-z]+/gi, "");

/**
 * A fuzzy-version member can legitimately mismatch on file id (the "incorrect update chains"
 * case), so testRefByIdentifiers' definitive file-id check is not enough on its own - it
 * returns false on a file-id mismatch before any name comparison. This fallback matches such a
 * member by file name instead, and (unlike the previous inline version) guards `fileNames` and
 * the rule's `logicalFileName` before dereferencing them.
 */
function fuzzyChainMatch(identifiers: ISkippedDownloadIdentifiers, ref: IModReference): boolean {
  if (ref.versionMatch == null || !isFuzzyVersion(ref.versionMatch)) {
    return false;
  }
  if (identifiers.modId == null || ref.repo?.modId !== identifiers.modId.toString()) {
    return false;
  }
  const { fileNames } = identifiers;
  if (fileNames != null && fileNames.length > 0) {
    if (ref.logicalFileName == null) {
      return false;
    }
    const names = new Set(fileNames.map(sanitizeFileName));
    return names.has(sanitizeFileName(ref.logicalFileName));
  }
  // same mod page, fuzzy version, no file names to disambiguate - good enough to match
  return true;
}

/**
 * Match the skipped dependency's reference against a collection rule. This mirrors the previous
 * `collection-mod-skipped` handler exactly (tag is most reliable, then file hash, then logical
 * file name) so the automatic/premium skip path is behaviourally unchanged.
 */
function matchesReference(reference: IModReference, ruleRef: IModReference): boolean {
  if (reference.tag && ruleRef.tag === reference.tag) {
    return true;
  }
  if (reference.fileMD5 && ruleRef.fileMD5 === reference.fileMD5) {
    return true;
  }
  if (reference.logicalFileName && ruleRef.logicalFileName === reference.logicalFileName) {
    return true;
  }
  return false;
}

function matchesSkip(skip: ICollectionSkip, ref: IModReference): boolean {
  if ("reference" in skip) {
    return matchesReference(skip.reference, ref);
  }
  return testRefByIdentifiers(skip.identifiers, ref) || fuzzyChainMatch(skip.identifiers, ref);
}

/**
 * Mark the collection member that was skipped as ignored, directly against the active install
 * session. This is the single entry point for both skip journeys (premium/automatic via
 * InstallManager, free-user via nexus_integration) - they used to emit `collection-mod-skipped`
 * / `free-user-skipped-download` for the InstallDriver to handle, an artifact of collections
 * being a bundled extension. Now that collections is core, the skip site dispatches the decision
 * itself instead of emitting and forgetting.
 *
 * Writes the transient session status AND the durable `ignored` flag on the rule together - the
 * session is not persisted, so without the durable flag a mid-install restart would rehydrate a
 * skipped (required) member as "pending" and the collection could never complete. This is an
 * explicit decision to skip, so it intentionally overrides any terminal protection.
 *
 * Returns true if a member was matched and ignored.
 */
export function markCollectionMemberSkipped(api: IExtensionApi, skip: ICollectionSkip): boolean {
  const state = api.getState();
  // getCollectionActiveSession guards state.session?.collections - collections is an extension
  // reducer, so the slice can be absent (very early startup) where a raw deref would throw
  const session = getCollectionActiveSession(state);
  if (session === undefined) {
    // not installing a collection - the skip is unrelated to collection tracking
    return false;
  }

  const { gameId, collectionId, sessionId } = session;
  const rules = (state.persistent.mods[gameId]?.[collectionId]?.rules ?? []).filter((rule) =>
    isDependencyRule(rule),
  );
  // NOTE (LAZ-483 follow-up): find() returns the FIRST matching rule. This relies on collection
  // members having distinct identities; if two members share the matched identifier (e.g. the
  // same logicalFileName, or two fuzzy rules on one modId), the wrong member could be ignored.
  // The previous mDependentMods.find had the same ambiguity, so this is not a new regression -
  // but disambiguation (which member did the user actually skip?) needs investigation.
  const rule = rules.find((iter) => matchesSkip(skip, iter.reference));
  if (rule === undefined) {
    log("error", "could not find collection rule for skipped download", { skip });
    return false;
  }

  batchDispatch(api.store, [
    updateModStatus(sessionId, modRuleId(rule), "ignored"),
    addModRule(gameId, collectionId, { ...rule, ignored: true }),
  ]);
  return true;
}
