/**
 * Provides small shared helpers for Bluebird wrapping and error normalization.
 */
import Bluebird from 'bluebird';

/** Wraps an async function and returns a Bluebird-compatible function. */
export function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

/** Returns a readable message from an unknown error value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'number'
      || typeof err === 'boolean'
      || typeof err === 'bigint') {
    return `${err}`;
  }
  if (typeof err === 'symbol') {
    return err.toString();
  }
  if (err === null) {
    return 'null';
  }
  if (err === undefined) {
    return 'undefined';
  }
  if (typeof err === 'function') {
    return err.toString();
  }
  try {
    return (err as { toString: () => string }).toString();
  } catch (_err) {
    return Object.prototype.toString.call(err);
  }
}
