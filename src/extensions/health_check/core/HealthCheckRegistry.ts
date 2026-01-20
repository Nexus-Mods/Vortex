import type { IExtensionApi } from "../../../types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckTrigger,
  HealthCheckSeverity,
} from "../../../types/IHealthCheck";
import type {
  IHealthCheck,
  IHealthCheckEntry,
  IHealthCheckResult,
  ILegacyTestAdapter,
} from "../../../types/IHealthCheck";
import { log } from "../../../util/log";
import type { HealthCheckId } from "../types";

export class HealthCheckRegistry {
  private mHealthChecks: Map<HealthCheckId, IHealthCheckEntry> = new Map();
  private mTriggerMap: Map<HealthCheckTrigger, Set<HealthCheckId>> = new Map();
  private mExecutionQueue: Set<HealthCheckId> = new Set();
  private mApi: IExtensionApi;
  private mResults: Map<HealthCheckId, IHealthCheckResult> = new Map();

  constructor(api: IExtensionApi) {
    this.mApi = api;

    // Initialize trigger maps
    Object.values(HealthCheckTrigger).forEach((trigger) => {
      this.mTriggerMap.set(trigger, new Set());
    });
  }

  /**
   * Register a new health check
   */
  public register(healthCheck: IHealthCheck | ILegacyTestAdapter): void {
    const entry: IHealthCheckEntry = {
      healthCheck,
      enabled: true,
      lastResult: undefined,
      lastExecuted: undefined,
      cachedUntil: undefined,
    };

    const checkId = healthCheck.id as HealthCheckId;
    this.mHealthChecks.set(checkId, entry);

    // Add to trigger maps
    healthCheck.triggers.forEach((trigger) => {
      const triggerSet = this.mTriggerMap.get(trigger);
      if (triggerSet) {
        triggerSet.add(checkId);
      }
    });

    log("debug", "Health check registered", {
      id: healthCheck.id,
      name: healthCheck.name,
      category: healthCheck.category,
      triggers: healthCheck.triggers,
      isLegacy: "isLegacyTest" in healthCheck,
    });
  }

  /**
   * Get all registered health checks
   */
  public getAll(): IHealthCheckEntry[] {
    return Array.from(this.mHealthChecks.values());
  }

  /**
   * Get health checks by category
   */
  public getByCategory(category: HealthCheckCategory): IHealthCheckEntry[] {
    return this.getAll().filter(
      (entry) => entry.healthCheck.category === category,
    );
  }

  /**
   * Get health checks by trigger
   */
  public getByTrigger(trigger: HealthCheckTrigger): IHealthCheckEntry[] {
    const triggerSet = this.mTriggerMap.get(trigger);
    if (!triggerSet) {
      return [];
    }

    return Array.from(triggerSet)
      .map((id) => this.mHealthChecks.get(id))
      .filter(
        (entry): entry is IHealthCheckEntry =>
          entry !== undefined && entry.enabled,
      );
  }

  /**
   * Get a specific health check by ID
   */
  public get(id: HealthCheckId): IHealthCheckEntry | undefined {
    return this.mHealthChecks.get(id);
  }

  /**
   * Unregister a health check
   */
  public unregisterHealthCheck(checkId: HealthCheckId): void {
    const entry = this.mHealthChecks.get(checkId);
    if (entry) {
      // Remove from trigger maps
      entry.healthCheck.triggers.forEach((trigger) => {
        const triggerSet = this.mTriggerMap.get(trigger);
        if (triggerSet) {
          triggerSet.delete(checkId);
        }
      });

      // Remove from main map
      this.mHealthChecks.delete(checkId);
      this.mResults.delete(checkId);

      log("debug", "Health check unregistered", { id: checkId });
    }
  }

  /**
   * Enable or disable a health check
   */
  public setEnabled(id: HealthCheckId, enabled: boolean): void {
    const entry = this.mHealthChecks.get(id);
    if (entry) {
      entry.enabled = enabled;
      log("debug", "Health check enabled state changed", { id, enabled });
    }
  }

  /**
   * Execute a specific health check
   */
  public async runHealthCheck(
    checkId: HealthCheckId,
    api: IExtensionApi,
    force?: boolean,
  ): Promise<IHealthCheckResult | undefined> {
    const entry = this.mHealthChecks.get(checkId);
    if (!entry || !entry.enabled) {
      return undefined;
    }

    // Check if result is cached (unless force is true)
    if (
      !force &&
      entry.cachedUntil &&
      entry.lastResult &&
      new Date() < entry.cachedUntil
    ) {
      log("debug", "Using cached result for health check", { id: checkId });
      return entry.lastResult;
    }

    // Prevent concurrent execution of the same check
    if (this.mExecutionQueue.has(checkId)) {
      log("debug", "Health check already executing, skipping", { id: checkId });
      return entry.lastResult;
    }

    this.mExecutionQueue.add(checkId);
    const startTime = Date.now();

    try {
      const timeout = entry.healthCheck.timeout || 30000;
      log("debug", "Executing health check", { id: checkId, timeout });

      const timeoutPromise = new Promise<IHealthCheckResult>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Health check timed out after ${timeout}ms`)),
          timeout,
        );
      });

      const result = await Promise.race([
        entry.healthCheck.check(api),
        timeoutPromise,
      ]);

      result.checkId = checkId;
      result.timestamp = new Date();
      result.executionTime = Date.now() - startTime;

      if (
        entry.healthCheck.cacheDuration &&
        entry.healthCheck.cacheDuration > 0
      ) {
        entry.cachedUntil = new Date(
          Date.now() + entry.healthCheck.cacheDuration,
        );
      }

      entry.lastResult = result;
      entry.lastExecuted = new Date();
      this.mResults.set(checkId, result);

      log("debug", "Health check completed", {
        id: checkId,
        status: result.status,
        severity: result.severity,
        executionTime: result.executionTime,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      const errorResult: IHealthCheckResult = {
        checkId,
        status: "error",
        severity: HealthCheckSeverity.Error,
        message: `Health check failed: ${err.message || "Unknown error"}`,
        details: err.stack,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        isLegacyTest: "isLegacyTest" in entry.healthCheck,
      };

      entry.lastResult = errorResult;
      entry.lastExecuted = new Date();
      this.mResults.set(checkId, errorResult);

      log("warn", "Health check failed", {
        id: checkId,
        error: err.message || "Unknown error",
      });

      return errorResult;
    } finally {
      this.mExecutionQueue.delete(checkId);
    }
  }

  /**
   * Execute all health checks for a specific trigger
   */
  public async runChecksByTrigger(
    trigger: HealthCheckTrigger,
    api: IExtensionApi,
  ): Promise<IHealthCheckResult[]> {
    const checks = this.getByTrigger(trigger);
    log("debug", "Executing health checks by trigger", {
      trigger,
      count: checks.length,
    });

    const results = await Promise.all(
      checks.map((entry) =>
        this.runHealthCheck(entry.healthCheck.id as HealthCheckId, api),
      ),
    );

    return results.filter(
      (result): result is IHealthCheckResult => result !== undefined,
    );
  }

  /**
   * Execute all registered health checks
   */
  public async runAllHealthChecks(
    api: IExtensionApi,
  ): Promise<IHealthCheckResult[]> {
    const checks = this.getAll().filter((entry) => entry.enabled);
    log("debug", "Executing all health checks", { count: checks.length });

    const results = await Promise.all(
      checks.map((entry) =>
        this.runHealthCheck(entry.healthCheck.id as HealthCheckId, api),
      ),
    );

    return results.filter(
      (result): result is IHealthCheckResult => result !== undefined,
    );
  }

  /**
   * Get all cached results
   */
  public getResults(): { [checkId in HealthCheckId]?: IHealthCheckResult } {
    const resultsObj: { [checkId in HealthCheckId]?: IHealthCheckResult } = {};
    this.mResults.forEach((result, checkId) => {
      resultsObj[checkId] = result;
    });
    return resultsObj;
  }

  /**
   * Clear all cached results
   */
  public clearResults(): void {
    this.mResults.clear();
    this.mHealthChecks.forEach((entry) => {
      entry.lastResult = undefined;
      entry.lastExecuted = undefined;
      entry.cachedUntil = undefined;
    });
    log("debug", "All health check results cleared");
  }

  /**
   * Get the API instance
   */
  public getApi(): IExtensionApi {
    return this.mApi;
  }

  /**
   * Get summary statistics
   */
  public getSummary(): {
    total: number;
    enabled: number;
    categories: Record<HealthCheckCategory, number>;
    lastResults: {
      passed: number;
      failed: number;
      warning: number;
      error: number;
    };
  } {
    const all = this.getAll();
    const enabled = all.filter((entry) => entry.enabled);

    const categories: Record<HealthCheckCategory, number> = {
      [HealthCheckCategory.System]: 0,
      [HealthCheckCategory.Game]: 0,
      [HealthCheckCategory.Mods]: 0,
      [HealthCheckCategory.Tools]: 0,
      [HealthCheckCategory.Performance]: 0,
      [HealthCheckCategory.Legacy]: 0,
      [HealthCheckCategory.Requirements]: 0,
    };

    const lastResults = {
      passed: 0,
      failed: 0,
      warning: 0,
      error: 0,
    };

    enabled.forEach((entry) => {
      categories[entry.healthCheck.category]++;

      if (entry.lastResult) {
        const status = entry.lastResult.status as keyof typeof lastResults;
        if (status in lastResults) {
          lastResults[status]++;
        }
      }
    });

    return {
      total: all.length,
      enabled: enabled.length,
      categories,
      lastResults,
    };
  }

  /**
   * Store a health check result manually (for intercepted test notifications)
   */
  public storeResult(id: HealthCheckId, result: IHealthCheckResult): void {
    const entry = this.get(id);
    if (entry) {
      entry.lastResult = result;
      entry.lastExecuted = result.timestamp;

      log("debug", "Stored health check result", {
        id,
        status: result.status,
        message: result.message,
      });
    } else {
      log("warn", "Attempted to store result for unknown health check", { id });
    }
  }
}
