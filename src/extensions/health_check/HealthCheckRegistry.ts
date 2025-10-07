import { IExtensionApi } from '../../types/IExtensionContext';
import { 
  IHealthCheck, 
  IHealthCheckEntry, 
  IHealthCheckResult, 
  ILegacyTestAdapter,
  HealthCheckTrigger,
  HealthCheckCategory,
  HealthCheckSeverity 
} from '../../types/IHealthCheck';
import { log } from '../../util/log';
import { setdefault } from '../../util/util';
import Bluebird from 'bluebird';

export class HealthCheckRegistry {
  private mHealthChecks: Map<string, IHealthCheckEntry> = new Map();
  private mTriggerMap: Map<HealthCheckTrigger, Set<string>> = new Map();
  private mExecutionQueue: Set<string> = new Set();
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
    
    // Initialize trigger maps
    Object.values(HealthCheckTrigger).forEach(trigger => {
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
      cachedUntil: undefined
    };

    this.mHealthChecks.set(healthCheck.id, entry);

    // Add to trigger maps
    healthCheck.triggers.forEach(trigger => {
      const triggerSet = this.mTriggerMap.get(trigger);
      if (triggerSet) {
        triggerSet.add(healthCheck.id);
      }
    });

    log('debug', 'Health check registered', {
      id: healthCheck.id,
      name: healthCheck.name,
      category: healthCheck.category,
      triggers: healthCheck.triggers,
      isLegacy: 'isLegacyTest' in healthCheck
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
    return this.getAll().filter(entry => entry.healthCheck.category === category);
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
      .map(id => this.mHealthChecks.get(id))
      .filter((entry): entry is IHealthCheckEntry => entry !== undefined && entry.enabled);
  }

  /**
   * Get a specific health check by ID
   */
  public get(id: string): IHealthCheckEntry | undefined {
    return this.mHealthChecks.get(id);
  }

  /**
   * Enable or disable a health check
   */
  public setEnabled(id: string, enabled: boolean): void {
    const entry = this.mHealthChecks.get(id);
    if (entry) {
      entry.enabled = enabled;
      log('debug', 'Health check enabled state changed', { id, enabled });
    }
  }

  /**
   * Execute a specific health check
   */
  public async executeCheck(id: string): Promise<IHealthCheckResult | undefined> {
    const entry = this.mHealthChecks.get(id);
    if (!entry || !entry.enabled) {
      return undefined;
    }

    // Check if result is cached
    if (entry.cachedUntil && entry.lastResult && new Date() < entry.cachedUntil) {
      log('debug', 'Using cached result for health check', { id });
      return entry.lastResult;
    }

    // Prevent concurrent execution of the same check
    if (this.mExecutionQueue.has(id)) {
      log('debug', 'Health check already executing, skipping', { id });
      return entry.lastResult;
    }

    this.mExecutionQueue.add(id);

    try {
      const startTime = Date.now();
      const timeout = entry.healthCheck.timeout || 30000;

      log('debug', 'Executing health check', { id, timeout });

      // Create timeout promise
      const timeoutPromise = new Promise<IHealthCheckResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Health check timed out after ${timeout}ms`)), timeout);
      });

      // Execute the check with timeout
      const resultPromise = entry.healthCheck.check(this.mApi);
      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Update result with metadata
      result.checkId = id;
      result.timestamp = new Date();
      result.executionTime = Date.now() - startTime;

      // Cache result if specified
      if (entry.healthCheck.cacheDuration && entry.healthCheck.cacheDuration > 0) {
        entry.cachedUntil = new Date(Date.now() + entry.healthCheck.cacheDuration);
      }

      // Store result
      entry.lastResult = result;
      entry.lastExecuted = new Date();

      log('debug', 'Health check completed', {
        id,
        status: result.status,
        severity: result.severity,
        executionTime: result.executionTime
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - Date.now();
      const err = error as Error;
      const errorResult: IHealthCheckResult = {
        checkId: id,
        status: 'error',
        severity: HealthCheckSeverity.Error,
        message: `Health check failed: ${err.message || 'Unknown error'}`,
        details: err.stack,
        executionTime,
        timestamp: new Date(),
        isLegacyTest: 'isLegacyTest' in entry.healthCheck
      };

      entry.lastResult = errorResult;
      entry.lastExecuted = new Date();

      log('warn', 'Health check failed', {
        id,
        error: err.message || 'Unknown error',
        stack: err.stack
      });

      return errorResult;

    } finally {
      this.mExecutionQueue.delete(id);
    }
  }

  /**
   * Execute all health checks for a specific trigger
   */
  public async executeByTrigger(trigger: HealthCheckTrigger): Promise<IHealthCheckResult[]> {
    const checks = this.getByTrigger(trigger);
    log('debug', 'Executing health checks by trigger', { trigger, count: checks.length });

    const results = await Promise.all(
      checks.map(entry => this.executeCheck(entry.healthCheck.id))
    );

    return results.filter((result): result is IHealthCheckResult => result !== undefined);
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
    const enabled = all.filter(entry => entry.enabled);
    
    const categories: Record<HealthCheckCategory, number> = {
      [HealthCheckCategory.System]: 0,
      [HealthCheckCategory.Game]: 0,
      [HealthCheckCategory.Mods]: 0,
      [HealthCheckCategory.Tools]: 0,
      [HealthCheckCategory.Performance]: 0,
      [HealthCheckCategory.Legacy]: 0
    };

    const lastResults = {
      passed: 0,
      failed: 0,
      warning: 0,
      error: 0
    };

    enabled.forEach(entry => {
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
      lastResults
    };
  }

  /**
   * Store a health check result manually (for intercepted test notifications)
   */
  public storeResult(id: string, result: IHealthCheckResult): void {
    const entry = this.get(id);
    if (entry) {
      entry.lastResult = result;
      entry.lastExecuted = result.timestamp;
      
      log('debug', 'Stored health check result', { 
        id, 
        status: result.status, 
        message: result.message 
      });
    } else {
      log('warn', 'Attempted to store result for unknown health check', { id });
    }
  }
}