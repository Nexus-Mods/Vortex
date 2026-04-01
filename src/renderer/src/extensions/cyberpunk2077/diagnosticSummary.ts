import type { DiagnosticResult } from "@vortex/shared/ipc";

export interface ICyberpunkDiagnosticSummary {
  total: number;
  conflicts: number;
  parser: number;
  dependencies: number;
  other: number;
}

export function summarizeCyberpunkDiagnostics(
  diagnostics: DiagnosticResult[],
): ICyberpunkDiagnosticSummary {
  return diagnostics.reduce<ICyberpunkDiagnosticSummary>(
    (accum, diagnostic) => {
      accum.total += 1;
      switch (diagnostic.kind) {
        case "conflict":
          accum.conflicts += 1;
          break;
        case "parser":
          accum.parser += 1;
          break;
        case "missing-dependency":
        case "framework":
          accum.dependencies += 1;
          break;
        default:
          accum.other += 1;
          break;
      }
      return accum;
    },
    {
      total: 0,
      conflicts: 0,
      parser: 0,
      dependencies: 0,
      other: 0,
    },
  );
}

