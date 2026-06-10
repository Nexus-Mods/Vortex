import type {
  Candidate,
  CandidateRow,
  FileRequirementsContext,
  FileRequirementsReport,
  FileVersionDetail,
  InstalledFile,
  ModDetail,
} from "./types";

// MAIN, UPDATE, OPTIONAL, MISC
const activeCategories = new Set([1, 2, 3, 5]);
const availableCategories = new Set([1, 2, 3, 4, 5, 7]);
const availableStatuses = new Set(["published", "hidden"]);

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

// One winner per update group: available candidate with the highest position.
// Matching installed files uses all candidates; eligibility only gates recommendations.
function selectRecommended(defRows: CandidateRow[]): CandidateRow[] {
  const byGroup = groupBy(defRows.filter(isAvailable), (r) => r.modFileId);

  // For each group, pick the highest active candidate, if any; otherwise the highest available.
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
    versionUid: row.versionUid,
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

export async function checkFileLevelRequirements(
  context: FileRequirementsContext,
): Promise<FileRequirementsReport> {
  const { installedFiles, ports } = context;
  const enabled = installedFiles.filter((f) => f.enabled);
  if (enabled.length === 0) return { sources: [] };

  // Get the installed files update group ids (modFileId)
  // TODO(cache): a file version's update group + position rarely change
  // consider caching by versionUid → detail across runs and refresh occasionally.
  const installedDetails = await ports.fetchFileVersionDetails(
    installedFiles.map((f) => f.fileUid),
  );
  const chainOf = mapByKey(installedDetails, (d) => d.uid);

  // Index installed files for quick lookup
  const enabledByUid = new Map<string, boolean>();
  const installedByChain = new Map<string, InstalledFile[]>();

  for (const f of installedFiles) {
    enabledByUid.set(f.fileUid, f.enabled);

    const chain = chainOf.get(f.fileUid)?.modFileId;
    if (chain === undefined) continue;

    const bucket = installedByChain.get(chain);
    if (bucket) bucket.push(f);
    else installedByChain.set(chain, [f]);
  }

  // TODO(cache): a source file's dependencies rarely change between runs
  // consider caching by sourceVersionUid → candidate rows and refresh occasionally.
  const candidates = await ports.fetchCandidates(enabled.map((f) => f.fileUid));
  if (candidates.length === 0) return { sources: [] };

  // Classify each dependency; only recommend when no matching version is owned.
  const plan = [...groupBy(candidates, (c) => c.sourceVersionUid)].map(
    ([sourceFileUid, srcRows]) => ({
      sourceFileUid,
      defs: [...groupBy(srcRows, (c) => c.definitionId)].map(([definitionId, defRows]) => {
        const candidateVersionUids = new Set(defRows.map((r) => r.versionUid));
        const targetGroups = new Set(defRows.map((r) => r.modFileId));

        const satisfyingEnabled: string[] = [];
        const satisfyingDisabled: string[] = [];
        const wrongEnabled: string[] = [];
        const wrongDisabled: string[] = [];

        // Find matches in installed files
        for (const versionUid of candidateVersionUids) {
          const enabled = enabledByUid.get(versionUid);
          if (enabled === undefined) continue;
          (enabled ? satisfyingEnabled : satisfyingDisabled).push(versionUid);
        }

        // Find other versions of a dependency target chain (wrong version).
        for (const group of targetGroups) {
          for (const f of installedByChain.get(group) ?? []) {
            if (candidateVersionUids.has(f.fileUid)) continue;
            (f.enabled ? wrongEnabled : wrongDisabled).push(f.fileUid);
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
  const recVersionUids = unique(recRows.map((r) => r.versionUid));
  const recModUids = unique(recRows.map((r) => r.modUid));
  const detailByUid = mapByKey(
    recVersionUids.length ? await ports.fetchFileVersionDetails(recVersionUids) : [],
    (d) => d.uid,
  );
  const modByUid = mapByKey(
    recModUids.length ? await ports.fetchModDetails(recModUids) : [],
    (m) => m.modUid,
  );

  const sources = plan.map(({ sourceFileUid, defs }) => ({
    sourceFileUid,
    dependencies: defs.map(({ recRows: rec, ...dep }) => ({
      ...dep,
      recommended: rec.map((r) =>
        toCandidate(r, detailByUid.get(r.versionUid), modByUid.get(r.modUid)),
      ),
    })),
  }));

  return { sources };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function mapByKey<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const item of items) out.set(key(item), item);
  return out;
}
