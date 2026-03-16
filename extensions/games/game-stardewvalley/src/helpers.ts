/* eslint-disable */
import Bluebird from 'bluebird';

/**
 * Shared utility helpers for the Stardew Valley extension.
 *
 * - `toBlue` wraps async functions so Vortex handlers can return Bluebird.
 * - `errorMessage` normalizes unknown errors to a user/log-friendly string.
 */
export function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
