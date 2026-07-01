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
  // Excluded files still satisfy others below; they just don't emit their own.
  const sourceFiles = installedFiles.filter((f) => f.enabled && f.emitRequirements !== false);
  if (sourceFiles.length === 0) return { sources: [] };

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
  const candidates = await ports.fetchCandidates(sourceFiles.map((f) => f.fileVersionUid));
  if (candidates.length === 0) return { sources: [] };

  // Classify per branch (update group / OR alternative) so one branch never suppresses
  // the others; a non-OR requirement is just a single branch.
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
  const plan = [...groupBy(candidates, (c) => c.sourceFileVersionUid)].map(
    ([sourceFileVersionUid, srcRows]) => ({
      sourceFileVersionUid,
      defs: [...groupBy(srcRows, (c) => c.definitionId)].map(([definitionId, defRows]) => {
        const branches = [...groupBy(defRows, (r) => r.modFileId)].map(([modFileId, branchRows]) =>
          classifyBranch(modFileId, branchRows, enabledByUid, installedByChain),
        );
        // OR satisfied: one branch has an enabled acceptable version, so don't
        // recommend (or hydrate) downloads for the alternatives.
        if (branches.some((b) => b.satisfyingEnabled.length > 0)) {
          for (const b of branches) b.recRow = undefined;
        }
        return { definitionId, branches };
      }),
    }),
  );

  // Hydrate only the recommended candidates (files the user doesn't have).
  // TODO(cache): consider caching candidate display data
  const recRows = plan.flatMap((s) =>
    s.defs.flatMap((d) => d.branches.flatMap((b) => (b.recRow ? [b.recRow] : []))),
  );
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
    dependencies: defs.map(({ definitionId, branches }) => ({
      definitionId,
      branches: branches.map(({ recRow, ...branch }) => ({
        ...branch,
        recommended: recRow
          ? toCandidate(recRow, detailByUid.get(recRow.fileVersionUid), modByUid.get(recRow.modUid))
          : undefined,
      })),
    })),
  }));

  return { sources };
}

interface BranchPlan {
  modFileId: string;
  satisfyingEnabled: string[];
  satisfyingDisabled: string[];
  wrongEnabled: string[];
  wrongDisabled: string[];
  recRow?: CandidateRow;
}

/** Classify one branch: a single update group within a dependency definition. */
function classifyBranch(
  modFileId: string,
  branchRows: CandidateRow[],
  enabledByUid: Map<string, boolean>,
  installedByChain: Map<string, InstalledFile[]>,
): BranchPlan {
  const candidateUids = new Set(branchRows.map((r) => r.fileVersionUid));

  const satisfyingEnabled: string[] = [];
  const satisfyingDisabled: string[] = [];
  const wrongEnabled: string[] = [];
  const wrongDisabled: string[] = [];

  // Acceptable versions the user already has, by enabled state.
  for (const uid of candidateUids) {
    const isEnabled = enabledByUid.get(uid);
    if (isEnabled === undefined) continue;
    (isEnabled ? satisfyingEnabled : satisfyingDisabled).push(uid);
    // TODO: could break early on match, if simple resolver and
    // consumer doesn't want all the matches or the wrong version data.
  }

  // Other (non-acceptable) versions of the same chain the user has installed.
  for (const f of installedByChain.get(modFileId) ?? []) {
    if (candidateUids.has(f.fileVersionUid)) continue;
    (f.enabled ? wrongEnabled : wrongDisabled).push(f.fileVersionUid);
  }

  // Recommend a download only when this branch has no acceptable version owned.
  const owned = satisfyingEnabled.length + satisfyingDisabled.length > 0;
  const recRow = owned ? undefined : selectRecommended(branchRows);

  return { modFileId, satisfyingEnabled, satisfyingDisabled, wrongEnabled, wrongDisabled, recRow };
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

// Highest-position available candidate (preferring active categories). Eligibility
// gates recommendations only, not matching.
function selectRecommended(branchRows: CandidateRow[]): CandidateRow | undefined {
  const available = branchRows.filter(isAvailable);
  if (available.length === 0) return undefined;
  const active = available.filter(isActive);
  return highestPosition(active.length > 0 ? active : available);
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
