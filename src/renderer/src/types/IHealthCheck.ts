import type { IExtensionApi, CheckFunction } from "./IExtensionContext";

export enum HealthCheckCategory {
  System = "system",
  Game = "game",
  Mods = "mods",
  Requirements = "requirements",
  Tools = "tools",
  Performance = "performance",
  Legacy = "legacy",
}

export enum HealthCheckSeverity {
  Info = "info",
  Warning = "warning",
  Error = "error",
  Critical = "critical",
}

export enum HealthCheckTrigger {
  Manual = "manual",
  Startup = "startup",
  GameChanged = "game-changed",
  ProfileChanged = "profile-changed",
  ModsChanged = "mods-changed",
  ResultsChanged = "health-check-results-changed",
  SettingsChanged = "settings-changed",
  PluginsChanged = "plugins-changed",
  LootUpdated = "loot-updated",
  Scheduled = "scheduled",
}

export interface IHealthCheckResult {
  checkId: string;
  status: "passed" | "failed" | "warning" | "error";
  severity: HealthCheckSeverity;
  message: string;
  details?: string;
  metadata?: { [key: string]: any };
  executionTime: number;
  timestamp: Date;
  fixAvailable?: boolean;
  isLegacyTest?: boolean;
}

export type HealthCheckFunction = (api: IExtensionApi) => Promise<IHealthCheckResult>;
export type HealthCheckFixFunction = (api: IExtensionApi) => Promise<void>;

export interface IHealthCheck {
  id: string;
  name: string;
  description: string;
  category: HealthCheckCategory;
  severity: HealthCheckSeverity;
  triggers: HealthCheckTrigger[];
  dependencies?: string[];
  timeout?: number;
  cacheDuration?: number;
  check: HealthCheckFunction;
  fix?: HealthCheckFixFunction;
  extensionName?: string;
}

export interface ILegacyTestAdapter extends IHealthCheck {
  eventType: string;
  originalCheck: CheckFunction;
  fix?: HealthCheckFixFunction;
  isLegacyTest: true;
}

export interface IHealthCheckEntry {
  healthCheck: IHealthCheck | IModHealthCheck | ILegacyTestAdapter;
  lastResult?: IHealthCheckResult;
  lastExecuted?: Date;
  enabled: boolean;
  cachedUntil?: Date;
}

/**
 * Context passed to a per-mod healthcheck for a single installed mod.
 *
 * - `files` lists paths relative to the mod's staging root.
 * - `readFile(p)` resolves a path under the mod root and returns its bytes.
 * - `attributes` reflects the attribute instructions emitted at install time
 *   (e.g. customFileName, author, version).
 */
export interface IModCheckContext {
  modId: string;
  files: string[];
  readFile: (path: string) => Promise<Buffer>;
  attributes: Record<string, unknown>;
}

export type PerModCheckFunction = (
  api: IExtensionApi,
  mod: IModCheckContext,
) => Promise<IHealthCheckResult>;

/**
 * Per-mod variant of IHealthCheck. The registry iterates installed mods for the
 * active game, calls `checkMod` per mod, and aggregates the results.
 * Identical metadata fields to IHealthCheck, with `checkMod` in place of `check`.
 *
 * `fix` is also omitted from the inherited fields: `HealthCheckFixFunction`
 * takes only `(api)` and can't meaningfully fix a per-mod problem. A per-mod
 * fix shape can be added in the future if needed.
 */
export interface IModHealthCheck extends Omit<IHealthCheck, "check" | "fix"> {
  checkMod: PerModCheckFunction;
}

/**
 * Type guard distinguishing the per-mod variant from a normal IHealthCheck.
 */
export function isModHealthCheck(
  hc: IHealthCheck | IModHealthCheck | ILegacyTestAdapter,
): hc is IModHealthCheck {
  return typeof (hc as IModHealthCheck).checkMod === "function";
}
