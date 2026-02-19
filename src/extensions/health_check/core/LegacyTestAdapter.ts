import type {
  CheckFunction,
  IExtensionApi,
} from "../../../renderer/types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
} from "../../../renderer/types/IHealthCheck";
import type {
  IHealthCheckResult,
  ILegacyTestAdapter,
} from "../../../renderer/types/IHealthCheck";
import type { HealthCheckRegistry } from "./HealthCheckRegistry";

export class LegacyTestAdapter {
  private mRegistry: HealthCheckRegistry;
  private mApi: IExtensionApi;

  constructor(registry: HealthCheckRegistry, api: IExtensionApi) {
    this.mRegistry = registry;
    this.mApi = api;
  }

  private generateHealthCheckId(
    legacyId: string,
    extensionName: string,
  ): string {
    return `legacy.${extensionName}.${legacyId}`;
  }

  private generateDisplayName(id: string): string {
    return id
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private generateDescription(id: string, extensionName: string): string {
    return `Legacy test "${id}" from ${extensionName} extension`;
  }

  private inferCategory(
    id: string,
    extensionName: string,
  ): HealthCheckCategory {
    const idLower = id.toLowerCase();
    const extLower = extensionName.toLowerCase();

    if (
      idLower.includes("plugin") ||
      idLower.includes("master") ||
      extLower.includes("plugin")
    ) {
      return HealthCheckCategory.Game;
    }
    if (
      idLower.includes("mod") ||
      idLower.includes("staging") ||
      idLower.includes("duplicate")
    ) {
      return HealthCheckCategory.Mods;
    }
    if (
      idLower.includes("tool") ||
      idLower.includes("extender") ||
      idLower.includes("fnis") ||
      idLower.includes("bepinex")
    ) {
      return HealthCheckCategory.Tools;
    }
    if (
      idLower.includes("startup") ||
      idLower.includes("permission") ||
      idLower.includes("net-current") ||
      idLower.includes("uninstall")
    ) {
      return HealthCheckCategory.System;
    }
    if (
      extLower.includes("gamebryo") ||
      extLower.includes("game-") ||
      extLower.includes("stardew") ||
      extLower.includes("witcher")
    ) {
      return HealthCheckCategory.Game;
    }
    if (extLower.includes("mod") && !extLower.includes("fomod")) {
      return HealthCheckCategory.Mods;
    }
    if (extLower.includes("download")) {
      return HealthCheckCategory.Mods;
    }
    if (
      extLower.includes("tool") ||
      extLower.includes("script") ||
      extLower.includes("fnis") ||
      extLower.includes("bepinex")
    ) {
      return HealthCheckCategory.Tools;
    }
    if (
      extLower.includes("fomod") ||
      extLower.includes("ini") ||
      extLower.includes("test-setup")
    ) {
      return HealthCheckCategory.System;
    }

    return HealthCheckCategory.Legacy;
  }

  private mapEventTypeToTriggers(eventType: string): HealthCheckTrigger[] {
    const mapping: { [key: string]: HealthCheckTrigger[] } = {
      startup: [HealthCheckTrigger.Startup, HealthCheckTrigger.Manual],
      "gamemode-activated": [
        HealthCheckTrigger.GameChanged,
        HealthCheckTrigger.Manual,
      ],
      "profile-did-change": [
        HealthCheckTrigger.ProfileChanged,
        HealthCheckTrigger.Manual,
      ],
      "settings-changed": [
        HealthCheckTrigger.SettingsChanged,
        HealthCheckTrigger.Manual,
      ],
      "mod-installed": [
        HealthCheckTrigger.ModsChanged,
        HealthCheckTrigger.Manual,
      ],
      "mod-activated": [
        HealthCheckTrigger.ModsChanged,
        HealthCheckTrigger.Manual,
      ],
      "plugins-changed": [
        HealthCheckTrigger.PluginsChanged,
        HealthCheckTrigger.Manual,
      ],
      "loot-info-updated": [
        HealthCheckTrigger.LootUpdated,
        HealthCheckTrigger.Manual,
      ],
    };

    return mapping[eventType] || [HealthCheckTrigger.Manual];
  }

  private wrapLegacyCheck(originalCheck: CheckFunction, checkId: string) {
    return (api: IExtensionApi): Promise<IHealthCheckResult> => {
      const startTime = Date.now();

      return Promise.resolve()
        .then(() => originalCheck())
        .then((legacyResult) => {
          const executionTime = Date.now() - startTime;

          if (!legacyResult) {
            return {
              checkId,
              status: "passed",
              severity: HealthCheckSeverity.Info,
              message: "Check passed",
              executionTime,
              timestamp: new Date(),
              isLegacyTest: true,
            } as IHealthCheckResult;
          }

          // Convert legacy result to new format
          return {
            checkId,
            status: this.mapLegacySeverityToStatus(legacyResult.severity),
            severity: this.mapLegacySeverity(legacyResult.severity),
            message: legacyResult.description.short,
            details: legacyResult.description.long,
            metadata: {
              legacyReplace: legacyResult.description.replace,
              legacyContext: legacyResult.description.context,
              localize: legacyResult.description.localize,
            },
            executionTime,
            timestamp: new Date(),
            fixAvailable: !!legacyResult.automaticFix,
            isLegacyTest: true,
          } as IHealthCheckResult;
        })
        .catch((error) => {
          const err = error as Error;
          return {
            checkId,
            status: "error",
            severity: HealthCheckSeverity.Error,
            message: `Legacy test failed: ${err.message || "Unknown error"}`,
            details: err.stack,
            executionTime: Date.now() - startTime,
            timestamp: new Date(),
            isLegacyTest: true,
          } as IHealthCheckResult;
        });
    };
  }

  private mapLegacySeverityToStatus(
    severity: "warning" | "error" | "fatal",
  ): "passed" | "failed" | "warning" | "error" {
    switch (severity) {
      case "warning":
        return "warning";
      case "error":
        return "failed";
      case "fatal":
        return "error";
      default:
        return "failed";
    }
  }

  private mapLegacySeverity(
    severity: "warning" | "error" | "fatal",
  ): HealthCheckSeverity {
    switch (severity) {
      case "warning":
        return HealthCheckSeverity.Warning;
      case "error":
        return HealthCheckSeverity.Error;
      case "fatal":
        return HealthCheckSeverity.Critical;
      default:
        return HealthCheckSeverity.Warning;
    }
  }

  private getExtensionName(): string {
    // Extract extension name from stack trace
    const stack = new Error().stack;
    if (stack) {
      const lines = stack.split("\n");
      for (const line of lines) {
        const extensionMatch = line.match(/extensions[/\\]([^/\\]+)[/\\]/);
        if (extensionMatch) {
          return extensionMatch[1];
        }

        const srcExtensionMatch = line.match(
          /src[/\\]extensions[/\\]([^/\\]+)[/\\]/,
        );
        if (srcExtensionMatch) {
          return srcExtensionMatch[1];
        }
      }
    }

    return "unknown-extension";
  }

  public createLegacyHealthCheck(
    id: string,
    eventType: string,
    check: CheckFunction,
    category?: HealthCheckCategory,
  ): ILegacyTestAdapter {
    const extensionName = this.getExtensionName() || "test-runner";
    const healthCheckId = this.generateHealthCheckId(id, extensionName);

    const healthCheck: ILegacyTestAdapter = {
      id: healthCheckId,
      name: this.generateDisplayName(id),
      description: this.generateDescription(id, extensionName),
      category: category || this.inferCategory(id, extensionName),
      severity: HealthCheckSeverity.Warning,
      triggers: this.mapEventTypeToTriggers(eventType),
      timeout: 30000,
      cacheDuration: 0,
      check: this.wrapLegacyCheck(check, healthCheckId),
      extensionName,
      eventType,
      originalCheck: check,
      isLegacyTest: true,
    };

    return healthCheck;
  }
}
