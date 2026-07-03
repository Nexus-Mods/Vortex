// Schema for the file-level requirements check (LAZ-552 / LAZ-473).

// Server-facing rows returned by the injected ports. camelCase; the Vortex
// implementation maps the snake_case V3 responses onto these.

export interface CandidateRow {
  sourceFileVersionUid: string;
  definitionId: string;
  modFileId: string; // update group
  fileVersionUid: string;
  position: string;
  category: number;
  modStatus: string;
  modUid: string;
}

export interface FileVersionDetail {
  fileVersionUid: string;
  modUid: string;
  modFileId: string;
  name: string;
  version: string;
}

export interface ModDetail {
  modUid: string;
  name: string;
  summary?: string;
  thumbnailUrl?: string;
  adultContent: boolean;
}

// Injected so the package stays portable (no HTTP/auth/nexus-api here).
// Paging lives in the implementation.
export interface ResolverPorts {
  fetchCandidates(fileVersionUids: string[]): Promise<CandidateRow[]>;
  fetchFileVersionDetails(fileVersionUids: string[]): Promise<FileVersionDetail[]>;
  fetchModDetails(modUids: string[]): Promise<ModDetail[]>;
}

export interface InstalledFile {
  fileVersionUid: string;
  enabled: boolean;
  // Emit this file's own dependencies as requirements (default true); collection-managed files set false.
  emitRequirements?: boolean;
}

export interface FileRequirementsContext {
  // Enabled AND disabled installed files for the active game.
  installedFiles: InstalledFile[];
  ports: ResolverPorts;
}

// The only hydrated payload in the report (a file the user doesn't have).
export interface Candidate {
  fileVersionUid: string;
  modUid: string;
  modFileId: string;
  category: number;
  position: string;
  fileName: string;
  version: string;
  modName: string;
  modSummary?: string;
  thumbnailUrl?: string;
  adultContent: boolean;
  sizeBytes?: number;
}

// One OR alternative (a single update group); a non-OR requirement has one branch.
export interface DependencyBranch {
  modFileId: string;
  // Acceptable versions the user has, by enabled state.
  satisfyingEnabled: string[];
  satisfyingDisabled: string[];
  // Other (non-acceptable) versions of the same chain the user has.
  wrongEnabled: string[];
  wrongDisabled: string[];
  // Download winner; set only when no acceptable version is owned.
  recommended?: Candidate;
}

export interface DependencyResult {
  definitionId: string;
  branches: DependencyBranch[];
}

export interface SourceResult {
  sourceFileVersionUid: string;
  dependencies: DependencyResult[];
}

export interface FileRequirementsReport {
  sources: SourceResult[];
}
