import type { ResolveRequest, ResolveResult } from "./types";

/**
 * Single resolution pass: map the input state to a result (LAZ-552).
 *
 * Pure and platform-agnostic - no I/O, no side effects. Given the same request
 * it must return the same result so the resolver loop is deterministic.
 *
 * TODO: implement.
 */
export function resolve(request: ResolveRequest): ResolveResult {
  void request;
  throw new Error("resolve() not implemented - see LAZ-552");
}
