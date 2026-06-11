import type {
  Candidate,
  CandidateRow,
  FileRequirementsContext,
  FileRequirementsReport,
  FileVersionDetail,
  InstalledFile,
  ModDetail,
} from "./types";

const activeCategories = new Set([1, 2, 3, 5]); // MAIN, UPDATE, OPTIONAL, MISC
const availableCategories = new Set([1, 2, 3, 4, 5, 7]); // MAIN, UPDATE, OPTIONAL, OLD, MISC, ARCHIVED
const availableStatuses = new Set(["published", "hidden"]);

export async function checkFileLevelRequirements(
  context: FileRequirementsContext,
): Promise<FileRequirementsReport> {
  const { installedFiles, ports } = context;
  const enabled = installedFiles.filter((f) => f.enabled);
  if (enabled.length === 0) return { sources: [] };

  // Get the installed files update group ids (modFileId)
  // TODO(cache): a file version's update group + position rarely change
  // consider caching by fileVersionUid → detail across runs and refresh occasionally.
  const installedDetails = await ports.fetchFileVersionDetails(
    installedFiles.map((f) => f.fileVersionUid),
  );
  const chainOf = mapByKey(installedDetails, (d) => d.fileVersionUid);

  // Index installed files for quick lookup
  const enabledByUid = new Map<string, boolean>();
  const installedByChain = new Map<string, InstalledFile[]>();

  for (const f of installedFiles) {
    enabledByUid.set(f.fileVersionUid, f.enabled);

    const chain = chainOf.get(f.fileVersionUid)?.modFileId;
    if (chain === undefined) continue;

    const bucket = installedByChain.get(chain);
    if (bucket) bucket.push(f);
    else installedByChain.set(chain, [f]);
  }

  // TODO(cache): a source file's dependencies rarely change between runs
  // consider caching by sourceFileVersionUid → candidate rows and refresh occasionally.
  const candidates = await ports.fetchCandidates(enabled.map((f) => f.fileVersionUid));
  if (candidates.length === 0) return { sources: [] };

  // Classify each dependency; only recommend when no matching version is owned.
  const plan = [...groupBy(candidates, (c) => c.sourceFileVersionUid)].map(
    ([sourceFileVersionUid, srcRows]) => ({
      sourceFileVersionUid,
      defs: [...groupBy(srcRows, (c) => c.definitionId)].map(([definitionId, defRows]) => {
        const candidateFileVersionUids = new Set(defRows.map((r) => r.fileVersionUid));
        const targetGroups = new Set(defRows.map((r) => r.modFileId));

        const satisfyingEnabled: string[] = [];
        const satisfyingDisabled: string[] = [];
        const wrongEnabled: string[] = [];
        const wrongDisabled: string[] = [];

        // TODO: advanced resolution would do set intersection between dependencies targeting the same file chain.
        // This would ensure the recommended candidate is compatible with the other dependencies.
        // But this also adds resolution complexity and many new outcome scenarios:
        // Outcomes:
        // - non-empty intersection → recommend from it, not each def's latest
        //   but user might prefer latest and updating the dep source instead
        // - empty intersection, no OR escape → conflict (unsatisfiable) between 2 or more files
        // - empty intersection but an OR-alternative chain works → resolvable via the alternative
        // - combination of all OR branch choices with different intersections ->
        //   different recommendations, different incompatibilities
        // Complexities:
        // - a conflict can span multiple source files (cross-source diamond)
        // - combinatorial set of outcomes based on OR branches, different recommendations, different conflicts.
        // - an installed/enabled version pins a chain's intersection

        // Find matches in installed files
        for (const fileVersionUid of candidateFileVersionUids) {
          const enabled = enabledByUid.get(fileVersionUid);
          if (enabled === undefined) continue;
          (enabled ? satisfyingEnabled : satisfyingDisabled).push(fileVersionUid);
          // TODO: could break early on match, if simple resolver and
          // consumer doesn't want all the matches or the wrong version data.
        }

        // Find other versions of a dependency target chain (wrong version).
        for (const group of targetGroups) {
          for (const f of installedByChain.get(group) ?? []) {
            if (candidateFileVersionUids.has(f.fileVersionUid)) continue;
            (f.enabled ? wrongEnabled : wrongDisabled).push(f.fileVersionUid);
          }
        }

        const owned = satisfyingEnabled.length + satisfyingDisabled.length > 0;
        const recRows = owned ? [] : selectRecommended(defRows);

        return {
          definitionId,
          satisfyingEnabled,
          satisfyingDisabled,
          wrongEnabled,
          wrongDisabled,
          recRows,
        };
      }),
    }),
  );

  // Hydrate only the recommended candidates (files the user doesn't have).
  // TODO(cache): consider caching candidate display data
  const recRows = plan.flatMap((s) => s.defs.flatMap((d) => d.recRows));
  const recFileVersionUids = unique(recRows.map((r) => r.fileVersionUid));
  const recModUids = unique(recRows.map((r) => r.modUid));
  const detailByUid = mapByKey(
    recFileVersionUids.length ? await ports.fetchFileVersionDetails(recFileVersionUids) : [],
    (d) => d.fileVersionUid,
  );
  const modByUid = mapByKey(
    recModUids.length ? await ports.fetchModDetails(recModUids) : [],
    (m) => m.modUid,
  );

  const sources = plan.map(({ sourceFileVersionUid, defs }) => ({
    sourceFileVersionUid,
    dependencies: defs.map(({ recRows: rec, ...dep }) => ({
      ...dep,
      recommended: rec.map((r) =>
        toCandidate(r, detailByUid.get(r.fileVersionUid), modByUid.get(r.modUid)),
      ),
    })),
  }));

  return { sources };
}

// Computed from the raw server signals; gates what we recommend, not matching.
function isAvailable(row: CandidateRow): boolean {
  return availableCategories.has(row.category) && availableStatuses.has(row.modStatus);
}

function isActive(row: CandidateRow): boolean {
  return activeCategories.has(row.category);
}

function highestPosition(rows: CandidateRow[]): CandidateRow {
  return rows.reduce((best, r) => (Number(r.position) > Number(best.position) ? r : best));
}

// One winner per update group: available candidate with the highest position.
// Matching installed files uses all candidates; eligibility only gates recommendations.
function selectRecommended(defRows: CandidateRow[]): CandidateRow[] {
  const byGroup = groupBy(defRows.filter(isAvailable), (r) => r.modFileId);

  // For each group, pick the highest active candidate, if any; otherwise the highest available.
  // TODO: with game version requirements, we could restrict to candidates matching installed game version.
  return [...byGroup.values()].map((rows) => {
    const active = rows.filter(isActive);
    return highestPosition(active.length > 0 ? active : rows);
  });
  // TODO: consider dropping inactive OR group candidates if the other group candidates are active.
}

function toCandidate(
  row: CandidateRow,
  detail: FileVersionDetail | undefined,
  mod: ModDetail | undefined,
): Candidate {
  return {
    fileVersionUid: row.fileVersionUid,
    modUid: row.modUid,
    modFileId: row.modFileId,
    category: row.category,
    position: row.position,
    fileName: detail?.name ?? "",
    version: detail?.version ?? "",
    modName: mod?.name ?? "",
    modSummary: mod?.summary,
    thumbnailUrl: mod?.thumbnailUrl,
    adultContent: mod?.adultContent ?? false,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function mapByKey<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) out.set(key(item), item);
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
