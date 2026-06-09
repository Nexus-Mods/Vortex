import { resolve } from "./resolve";
import type { ResolveRequest, ResolveResult } from "./types";

/**
 * Drives resolve() until it settles (LAZ-552).
 *
 * The loop calls resolve(); if the result needs user input (clashes / choices),
 * it asks the caller to make decisions, folds them back into the request, and
 * resolves again. Stays platform-agnostic: the caller owns how choices are
 * presented and how decisions are gathered.
 *
 * TODO: design the loop - decision callback signature, how decisions merge back
 * into the request, termination / iteration guards.
 */
export async function runResolverLoop(request: ResolveRequest): Promise<ResolveResult> {
  void request;
  throw new Error("runResolverLoop() not implemented - see LAZ-552");
}
