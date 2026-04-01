import type {
  DiagnosticResult,
  InternalGameArchiveEntry,
  InternalGameConflict,
} from "@vortex/shared/ipc";

export interface ICyberpunkArchiveParserFailure {
  modId?: string;
  modName?: string;
  archivePath: string;
  relativePath: string;
  message: string;
}

export function buildArchiveConflictDiagnostics(
  conflicts: InternalGameConflict[],
): DiagnosticResult[] {
  return conflicts.map((conflict, index) => {
    const label = conflict.mappedName ?? conflict.virtualPath ?? conflict.hash ?? "unknown hash";
    const relatedModIds = [
      conflict.winnerModId,
      ...conflict.loserModIds,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    return {
      id: `cyberpunk-archive-conflict-${conflict.hash ?? index}`,
      level: "warning",
      kind: "conflict",
      title: "Archive content conflict detected",
      message: `Multiple Cyberpunk mods provide the same archive content hash for ${label}.`,
      details: [
        conflict.hash ? `Hash: ${conflict.hash}` : undefined,
        conflict.winnerModId ? `Winner: ${conflict.winnerModId}` : undefined,
        conflict.loserModIds.length > 0
          ? `Losers: ${conflict.loserModIds.join(", ")}`
          : undefined,
      ]
        .filter((value): value is string => value != null)
        .join("\n"),
      relatedModIds,
      archiveEntryIds: [
        conflict.winnerEntryId,
        ...conflict.loserEntryIds,
      ].filter((value): value is string => typeof value === "string" && value.length > 0),
      fixType: "guided",
    };
  });
}

export function buildArchiveParserDiagnostics(
  failures: ICyberpunkArchiveParserFailure[],
): DiagnosticResult[] {
  return failures.map((failure, index) => ({
    id: `cyberpunk-archive-parser-${failure.modId ?? index}-${sanitizeDiagnosticId(failure.relativePath)}`,
    level: "warning",
    kind: "parser",
    title: "Archive parsing failed",
    message: `Vortex could not inspect ${failure.relativePath} for Cyberpunk archive conflicts.`,
    details: [
      failure.modName ? `Mod: ${failure.modName}` : undefined,
      `Archive: ${failure.archivePath}`,
      `Reason: ${failure.message}`,
    ]
      .filter((value): value is string => value != null)
      .join("\n"),
    relatedModIds: failure.modId != null ? [failure.modId] : undefined,
    fixType: "guided",
  }));
}

function sanitizeDiagnosticId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

