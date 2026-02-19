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

export type HealthCheckFunction = (
  api: IExtensionApi,
) => Promise<IHealthCheckResult>;
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
  healthCheck: IHealthCheck | ILegacyTestAdapter;
  lastResult?: IHealthCheckResult;
  lastExecuted?: Date;
  enabled: boolean;
  cachedUntil?: Date;
}
