import { log } from './log';

/**
 * Lightweight profiling utilities for performance monitoring.
 * 
 * These utilities provide minimal overhead timing and can be used to identify
 * performance bottlenecks in critical code paths.
 */

interface IProfileEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class ProfileManager {
  private mActiveProfiles: Map<string, IProfileEntry> = new Map();
  private mCompletedProfiles: IProfileEntry[] = [];
  private mEnabled: boolean = process.env.NODE_ENV === 'development';

  /**
   * Start timing a named operation.
   * @param name Unique identifier for this timing operation
   */
  public start(name: string): void {
    if (!this.mEnabled) {
      return;
    }

    if (this.mActiveProfiles.has(name)) {
      log('warn', 'Profiling: Overwriting active profile', { name });
    }

    this.mActiveProfiles.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  /**
   * End timing for a named operation and optionally log the result.
   * @param name Identifier for the timing operation
   * @param logResult Whether to log the timing result (default: true)
   * @returns Duration in milliseconds, or undefined if profiling is disabled
   */
  public end(name: string, logResult: boolean = true): number | undefined {
    if (!this.mEnabled) {
      return undefined;
    }

    const entry = this.mActiveProfiles.get(name);
    if (!entry) {
      log('warn', 'Profiling: No active profile found', { name });
      return undefined;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;

    const completedEntry: IProfileEntry = {
      ...entry,
      endTime,
      duration,
    };

    this.mActiveProfiles.delete(name);
    this.mCompletedProfiles.push(completedEntry);

    if (logResult) {
      log('debug', 'Profiling result', { 
        name, 
        duration: `${duration.toFixed(2)}ms` 
      });
    }

    return duration;
  }

  /**
   * Time a synchronous function execution.
   * @param name Identifier for this timing operation
   * @param fn Function to time
   * @param logResult Whether to log the timing result (default: true)
   * @returns The function's return value
   */
  public time<T>(name: string, fn: () => T, logResult: boolean = true): T {
    this.start(name);
    try {
      const result = fn();
      this.end(name, logResult);
      return result;
    } catch (error) {
      this.end(name, logResult);
      throw error;
    }
  }

  /**
   * Time an asynchronous function execution.
   * @param name Identifier for this timing operation
   * @param fn Async function to time
   * @param logResult Whether to log the timing result (default: true)
   * @returns Promise resolving to the function's return value
   */
  public async timeAsync<T>(name: string, fn: () => Promise<T>, logResult: boolean = true): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name, logResult);
      return result;
    } catch (error) {
      this.end(name, logResult);
      throw error;
    }
  }

  /**
   * Get all completed profiling entries.
   * @returns Array of completed profiling entries
   */
  public getCompletedProfiles(): IProfileEntry[] {
    return [...this.mCompletedProfiles];
  }

  /**
   * Clear all completed profiling entries.
   */
  public clearCompleted(): void {
    this.mCompletedProfiles.length = 0;
  }

  /**
   * Get summary statistics for completed profiles.
   * @returns Object with timing statistics
   */
  public getSummary(): { [name: string]: { count: number; totalTime: number; avgTime: number; minTime: number; maxTime: number } } {
    const summary: { [name: string]: { count: number; totalTime: number; avgTime: number; minTime: number; maxTime: number } } = {};

    for (const entry of this.mCompletedProfiles) {
      if (!entry.duration) continue;

      if (!summary[entry.name]) {
        summary[entry.name] = {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0,
        };
      }

      const stats = summary[entry.name];
      stats.count++;
      stats.totalTime += entry.duration;
      stats.minTime = Math.min(stats.minTime, entry.duration);
      stats.maxTime = Math.max(stats.maxTime, entry.duration);
      stats.avgTime = stats.totalTime / stats.count;
    }

    return summary;
  }

  /**
   * Enable or disable profiling.
   * @param enabled Whether profiling should be enabled
   */
  public setEnabled(enabled: boolean): void {
    this.mEnabled = enabled;
  }

  /**
   * Check if profiling is currently enabled.
   * @returns True if profiling is enabled
   */
  public isEnabled(): boolean {
    return this.mEnabled;
  }
}

// Global profiler instance
const profiler = new ProfileManager();

/**
 * Start timing a named operation.
 * Only active in development mode by default.
 * 
 * @param name Unique identifier for this timing operation
 * 
 * @example
 * profileStart('file-copy');
 * // ... do work ...
 * profileEnd('file-copy');
 */
export function profileStart(name: string): void {
  profiler.start(name);
}

/**
 * End timing for a named operation.
 * 
 * @param name Identifier for the timing operation
 * @param logResult Whether to log the timing result (default: true)
 * @returns Duration in milliseconds, or undefined if profiling is disabled
 * 
 * @example
 * profileStart('file-copy');
 * // ... do work ...
 * const duration = profileEnd('file-copy'); // logs: "Profiling result: file-copy 42.35ms"
 */
export function profileEnd(name: string, logResult: boolean = true): number | undefined {
  return profiler.end(name, logResult);
}

/**
 * Time a synchronous function execution.
 * 
 * @param name Identifier for this timing operation
 * @param fn Function to time
 * @param logResult Whether to log the timing result (default: true)
 * @returns The function's return value
 * 
 * @example
 * const result = profileTime('expensive-calculation', () => {
 *   return heavyComputation();
 * });
 */
export function profileTime<T>(name: string, fn: () => T, logResult: boolean = true): T {
  return profiler.time(name, fn, logResult);
}

/**
 * Time an asynchronous function execution.
 * 
 * @param name Identifier for this timing operation
 * @param fn Async function to time
 * @param logResult Whether to log the timing result (default: true)
 * @returns Promise resolving to the function's return value
 * 
 * @example
 * const result = await profileTimeAsync('file-operation', async () => {
 *   return await fs.readFileAsync('large-file.txt');
 * });
 */
export function profileTimeAsync<T>(name: string, fn: () => Promise<T>, logResult: boolean = true): Promise<T> {
  return profiler.timeAsync(name, fn, logResult);
}

/**
 * Get profiling summary statistics.
 * Useful for identifying performance patterns and bottlenecks.
 * 
 * @returns Object with timing statistics for each profiled operation
 * 
 * @example
 * const summary = getProfilingSummary();
 * console.log(summary);
 * // {
 * //   'file-copy': { count: 5, totalTime: 250.5, avgTime: 50.1, minTime: 42.3, maxTime: 67.8 },
 * //   'db-query': { count: 12, totalTime: 180.2, avgTime: 15.0, minTime: 8.1, maxTime: 45.2 }
 * // }
 */
export function getProfilingSummary(): { [name: string]: { count: number; totalTime: number; avgTime: number; minTime: number; maxTime: number } } {
  return profiler.getSummary();
}

/**
 * Clear all completed profiling entries.
 * Useful for resetting profiling data between test runs or operations.
 */
export function clearProfilingData(): void {
  profiler.clearCompleted();
}

/**
 * Enable or disable profiling at runtime.
 * 
 * @param enabled Whether profiling should be enabled
 * 
 * @example
 * setProfilingEnabled(true);  // Enable profiling
 * setProfilingEnabled(false); // Disable profiling (no overhead)
 */
export function setProfilingEnabled(enabled: boolean): void {
  profiler.setEnabled(enabled);
}

/**
 * Check if profiling is currently enabled.
 * 
 * @returns True if profiling is enabled
 */
export function isProfilingEnabled(): boolean {
  return profiler.isEnabled();
}