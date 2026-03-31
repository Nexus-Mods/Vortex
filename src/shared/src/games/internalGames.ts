export interface InternalGameToolManifest {
  id: string;
  name: string;
  shortName: string;
  executable: string;
  requiredFiles: string[];
  parameters: string[];
  relative: boolean;
  logo?: string;
  shell?: boolean;
  exclusive?: boolean;
}

export interface InternalGameManifest {
  id: string;
  name: string;
  mergeMods: boolean;
  queryModPath: string;
  executable: string;
  parameters: string[];
  requiredFiles: string[];
  logo?: string;
  environment?: Record<string, string>;
  details?: Record<string, string>;
  compatible?: {
    symlinks?: boolean;
  };
  supportedTools: InternalGameToolManifest[];
  requiresLauncher?: {
    launcher: string;
    addInfo?: string;
  } | null;
}

export interface InternalGameDiscoveryResult {
  path?: string;
  store?: string;
  tools?: Record<string, { path: string }>;
}

export interface InternalGameMod {
  id: string;
  name: string;
  enabled?: boolean;
  type?: string;
  fileId?: string;
  modId?: string;
  version?: string;
  attributes?: Record<string, unknown>;
}

export interface InternalGameLoadOrderEntry {
  id: string;
  name: string;
  enabled?: boolean;
  data?: Record<string, unknown>;
}

export interface InternalGameRuntimeSnapshot {
  gameId: string;
  activeProfileId?: string;
  discovery?: InternalGameDiscoveryResult;
  features?: Record<string, boolean>;
  mods?: InternalGameMod[];
  loadOrder?: InternalGameLoadOrderEntry[];
}

export interface InternalGameInstallFile {
  path: string;
  isDirectory?: boolean;
}

export interface InternalGameInstallRequest {
  files: InternalGameInstallFile[];
  stagingPath: string;
  archivePath?: string;
}

export interface InternalGameInstruction {
  type:
    | "copy"
    | "mkdir"
    | "submodule"
    | "generatefile"
    | "iniedit"
    | "unsupported"
    | "attribute"
    | "setmodtype"
    | "error"
    | "rule";
  path?: string;
  source?: string;
  destination?: string;
  section?: string;
  key?: string;
  value?: unknown;
  submoduleType?: string;
  data?: string;
  rule?: Record<string, unknown>;
}

export interface InstallerMatch {
  id: string;
  supported: boolean;
  requiredFiles: string[];
  message?: string;
}

export interface InstallPlan {
  installerId: string;
  instructions: InternalGameInstruction[];
  warnings?: string[];
  diagnostics?: DiagnosticResult[];
}

export interface LoadOrderSnapshot {
  entries: InternalGameLoadOrderEntry[];
  usageInstructions?: string;
  persistedPath?: string;
  validationMessages?: string[];
}

export interface InternalRunOptions {
  cwd?: string;
  shell?: boolean;
  detach?: boolean;
  expectSuccess?: boolean;
}

export interface ToolLaunchPlan {
  handled: boolean;
  executable?: string;
  args?: string[];
  options?: InternalRunOptions;
}

export interface DiagnosticResult {
  id: string;
  level: "info" | "warning" | "error";
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}
