import type { FileRequirementsContext, FileRequirementsReport } from "./types";

/**
 * Single entry point for the file-level requirements check (LAZ-552 / LAZ-473).
 * May fetch dependency data, so it is async. TODO: implement.
 */
export async function checkFileLevelRequirements(
  context: FileRequirementsContext,
): Promise<FileRequirementsReport> {
  void context;
  throw new Error("checkFileLevelRequirements() not implemented - see LAZ-552");
}
