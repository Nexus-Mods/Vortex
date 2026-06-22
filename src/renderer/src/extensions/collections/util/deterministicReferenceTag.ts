import { checksum } from "../../../util/checksum";
import type { IModInstallSpec, IModReference } from "../../mod_management/types/IMod";
import { isFuzzyVersion } from "../../mod_management/util/isFuzzyVersion";

/**
 * Derive a stable referenceTag for a collection member from its identity plus install spec,
 * replacing the random shortid that can drift across re-install.
 *
 * The identity is UPDATE-POLICY aware. An "exact" rule pins a file, so its fileMD5 is the stable
 * identity. A "prefers"/"latest" (fuzzy-version) rule resolves to whatever version is newest /
 * preferred, so its fileMD5 changes between versions - the only identity that is stable across
 * versions is the mod page, identified by the full repo triple (repository + gameId + modId), not
 * modId alone (a modId is only unique within a repository+game). The install spec is folded in so two rules that share
 * that identity but apply different patches / installer choices / file lists still get distinct
 * tags. Returns undefined when the relevant identity is absent (nothing stable to hash); the
 * caller then falls back to a random tag and re-attribution relies on the identity match.
 *
 * Only meaningful for collections authored with deterministic tags; legacy collections carry
 * random tags and are matched by identity (gated on the collectionInfo referenceTagScheme).
 */
export function deterministicReferenceTag(
  reference: IModReference,
  installSpec?: IModInstallSpec,
): string | undefined {
  // exact -> fileMD5 (the pinned file's content hash, globally unique); fuzzy (prefers/latest) ->
  // the mod PAGE (the resolved file and its md5 vary between versions). The page is the full repo
  // triple, not modId alone, since a modId is only unique within a repository+game. Each
  // install-spec part is normalised to null when absent OR empty ({}/[]): some collections export
  // empty objects/arrays where others omit the field, and both must yield the same tag.
  const fuzzy = isFuzzyVersion(reference.versionMatch);
  const repo = reference.repo;
  const coreIdentity = fuzzy
    ? repo?.modId == null
      ? undefined
      : { repository: repo.repository, gameId: repo.gameId, modId: repo.modId }
    : reference.fileMD5;
  if (coreIdentity == null) {
    return undefined;
  }
  const identity = {
    // tag the scheme so an exact fileMD5 and a fuzzy modId that share a string value can't collide
    scheme: fuzzy ? "modId" : "fileMD5",
    coreIdentity,
    installerChoices: nullIfEmpty(installSpec?.installerChoices),
    patches: nullIfEmpty(installSpec?.patches),
    fileList: nullIfEmpty(installSpec?.fileList),
  };
  return checksum(Buffer.from(stableStringify(identity)));
}

/**
 * Collapse an absent, empty-object, or empty-array value to null so a serialized-empty install
 * spec is treated identically to an omitted one. Non-empty values pass through unchanged.
 */
function nullIfEmpty<T>(value: T | undefined | null): T | null {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value;
  }
  if (typeof value === "object" && Object.keys(value).length === 0) {
    return null;
  }
  return value;
}

/**
 * JSON.stringify with recursively sorted object keys, so structurally equal inputs serialize
 * identically regardless of key insertion order (plain JSON.stringify is order-sensitive). Arrays
 * keep their order (it is meaningful for fileList / patches).
 */
function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
  return `{${entries.join(",")}}`;
}
