import type { IExtensionApi } from "../../types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IHealthCheckResult,
} from "../../types/IHealthCheck";

import { setHealthCheckRunning } from "./actions/session";
import type {
  IModMissingRequirements,
  IModRequirementExt,
  IHealthCheckApi,
} from "./types";
import {
  CYBERPUNK_DIAGNOSTICS_CHECK_ID,
  type HealthCheckId,
} from "./types";

export type CyberpunkDiagnosticKind =
  | "missing-dependency"
  | "framework"
  | "conflict"
  | "parser"
  | "deploy"
  | "root-hygiene"
  | "setup"
  | "guidance";

export type CyberpunkDiagnosticFixType =
  | "none"
  | "nexus-dependency"
  | "guided"
  | "open-url";

export interface ICyberpunkRequiringMod {
  modId: number;
  modName: string;
  modUrl?: string;
}

export interface ICyberpunkCanonicalDependency {
  gameId: string;
  modId: number;
  modName: string;
  modUrl?: string;
  fileId?: number;
}

export interface ICyberpunkDiagnosticPayload {
  id: string;
  kind: CyberpunkDiagnosticKind;
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  fixType?: CyberpunkDiagnosticFixType;
  requiredBy?: ICyberpunkRequiringMod;
  requiredByModId?: string;
  dependency?: ICyberpunkCanonicalDependency;
  relatedModIds?: string[];
  archiveEntryIds?: string[];
  details?: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface ICyberpunkDiagnosticsResultMetadata {
  gameId?: string;
  diagnostics: ICyberpunkDiagnosticPayload[];
  modRequirements: Record<string, IModMissingRequirements>;
  errors: string[];
}

export interface ICyberpunkDiagnosticsProvider {
  getDiagnostics: () => Promise<ICyberpunkDiagnosticPayload[]>;
  getGameId?: () => string | undefined;
}

export interface ICyberpunkDiagnosticsRegistration {
  id: HealthCheckId;
  unregister: () => void;
}

function mapSeverity(
  severity: ICyberpunkDiagnosticPayload["severity"],
): HealthCheckSeverity {
  switch (severity) {
    case "warning":
      return HealthCheckSeverity.Warning;
    case "error":
      return HealthCheckSeverity.Error;
    default:
      return HealthCheckSeverity.Info;
  }
}

export function makeCyberpunkRequirementUid(diagnosticId: string): string {
  return `cyberpunk:${diagnosticId}`;
}

function buildModUrl(dependency: ICyberpunkCanonicalDependency): string {
  return (
    dependency.modUrl ??
    `https://www.nexusmods.com/${dependency.gameId}/mods/${dependency.modId}`
  );
}

export function isFixableCyberpunkDiagnostic(
  diagnostic: ICyberpunkDiagnosticPayload,
): diagnostic is ICyberpunkDiagnosticPayload & {
  fixType: "nexus-dependency";
  dependency: ICyberpunkCanonicalDependency;
} {
  return (
    diagnostic.fixType === "nexus-dependency" &&
    diagnostic.dependency !== undefined
  );
}

export function toCyberpunkRequirement(
  diagnostic: ICyberpunkDiagnosticPayload,
): IModRequirementExt | undefined {
  if (!isFixableCyberpunkDiagnostic(diagnostic) || diagnostic.requiredBy === undefined) {
    return undefined;
  }

  const dependency = diagnostic.dependency;
  if (dependency === undefined) {
    return undefined;
  }

  return {
    uid: makeCyberpunkRequirementUid(diagnostic.id),
    id: makeCyberpunkRequirementUid(diagnostic.id),
    modId: dependency.modId,
    gameId: dependency.gameId,
    modName: dependency.modName,
    modUrl: buildModUrl(dependency),
    requiredBy: {
      modId: diagnostic.requiredBy.modId,
      modName: diagnostic.requiredBy.modName,
      modUrl: diagnostic.requiredBy.modUrl ?? "",
    },
    notes: diagnostic.details ?? diagnostic.message,
    externalRequirement: false,
  } as IModRequirementExt;
}

export function buildCyberpunkRequirementGroups(
  diagnostics: ICyberpunkDiagnosticPayload[],
): Record<string, IModMissingRequirements> {
  return diagnostics.reduce((accum, diagnostic) => {
    const requirement = toCyberpunkRequirement(diagnostic);
    if (requirement === undefined) {
      return accum;
    }

    const requiredBy = diagnostic.requiredBy;
    if (requiredBy === undefined) {
      return accum;
    }

    const requiredByModId =
      diagnostic.requiredByModId ?? String(requiredBy.modId);
    const nexusModId = requiredBy.modId;
    const modGroup = accum[requiredByModId] ?? {
      modId: requiredByModId,
      gameId: requirement.gameId,
      nexusModId,
      modName: requiredBy.modName,
      missingMods: [],
      dlcRequirements: [],
    };

    modGroup.missingMods.push(requirement);
    accum[requiredByModId] = modGroup;
    return accum;
  }, {} as Record<string, IModMissingRequirements>);
}

export function buildCyberpunkHealthCheckResult(
  diagnostics: ICyberpunkDiagnosticPayload[],
  gameId?: string,
): IHealthCheckResult {
  const fixable = diagnostics.filter(isFixableCyberpunkDiagnostic);
  const highestSeverity =
    diagnostics.find((item) => item.severity === "error") !== undefined
      ? "error"
      : diagnostics.find((item) => item.severity === "warning") !== undefined
        ? "warning"
        : "info";

  const summary =
    diagnostics.length === 0
      ? "Cyberpunk diagnostics passed"
      : `${fixable.length} fixable Cyberpunk issues, ${diagnostics.length - fixable.length} informational diagnostics`;

  return {
    checkId: CYBERPUNK_DIAGNOSTICS_CHECK_ID,
    status: diagnostics.length === 0 ? "passed" : highestSeverity === "error" ? "error" : "warning",
    severity: mapSeverity(highestSeverity as ICyberpunkDiagnosticPayload["severity"]),
    message: summary,
    details:
      diagnostics.length > 0
        ? diagnostics.map((item) => `${item.title}: ${item.message}`).join("\n")
        : undefined,
    metadata: {
      gameId,
      diagnostics,
      modRequirements: buildCyberpunkRequirementGroups(diagnostics),
      errors: [],
    } as ICyberpunkDiagnosticsResultMetadata,
    executionTime: 0,
    timestamp: new Date(),
    fixAvailable: fixable.length > 0,
  };
}

export async function registerCyberpunkDiagnosticsCheck(
  api: IExtensionApi,
  healthCheckApi: IHealthCheckApi,
  provider: ICyberpunkDiagnosticsProvider,
): Promise<ICyberpunkDiagnosticsRegistration> {
  const checkId = CYBERPUNK_DIAGNOSTICS_CHECK_ID;

  healthCheckApi.custom.register({
    id: checkId,
    name: "Cyberpunk Diagnostics",
    description:
      "Validates Cyberpunk-specific foundations, fixable dependencies, and main-process diagnostics",
    category: HealthCheckCategory.Requirements,
    severity: HealthCheckSeverity.Warning,
    triggers: [
      HealthCheckTrigger.Manual,
      HealthCheckTrigger.GameChanged,
      HealthCheckTrigger.ModsChanged,
      HealthCheckTrigger.ProfileChanged,
      HealthCheckTrigger.SettingsChanged,
    ],
    check: async () => {
      api.store?.dispatch(setHealthCheckRunning(checkId, true));
      try {
        const diagnostics = await provider.getDiagnostics();
        return buildCyberpunkHealthCheckResult(
          diagnostics,
          provider.getGameId?.(),
        );
      } finally {
        api.store?.dispatch(setHealthCheckRunning(checkId, false));
      }
    },
  });

  return {
    id: checkId,
    unregister: () => healthCheckApi.custom.unregister(checkId),
  };
}

export function isCyberpunkRequirement(
  requirement: IModRequirementExt | undefined,
): requirement is IModRequirementExt {
  return requirement !== undefined && requirement.uid.startsWith("cyberpunk:");
}

export function toCyberpunkDiagnosticsList(
  result?: IHealthCheckResult,
): ICyberpunkDiagnosticPayload[] {
  return (result?.metadata as ICyberpunkDiagnosticsResultMetadata | undefined)
    ?.diagnostics ?? [];
}

export function toCyberpunkRequirementsList(
  result?: IHealthCheckResult,
): IModRequirementExt[] {
  const requirements = (result?.metadata as ICyberpunkDiagnosticsResultMetadata | undefined)
    ?.modRequirements;

  if (requirements === undefined) {
    return [];
  }

  return Object.values(requirements).flatMap((group) => group.missingMods);
}
