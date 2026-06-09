/**
 * Schema for the file-dependency resolver (LAZ-552) - TO BE DESIGNED.
 *
 * Constraints to preserve while filling these in:
 *  - Pure and platform-agnostic: NO imports from Vortex, electron, nexus-api,
 *    redux, fs, etc. Same module must run on the client now and server-side later.
 *  - Inputs/outputs are plain serialisable data. This module only computes;
 *    the caller fetches data and performs actions.
 *
 * The resolver runs as a loop: resolve() produces a result that may need user
 * input (clashes / choices); decisions feed back into the next resolve() pass.
 */

/** Input to a single resolve() pass. TODO: define (installed files, declared requirements, prior decisions, options). */
export interface ResolveRequest {
  // TODO
}

/** Output of a single resolve() pass; must be suitable for the healthcheck page. */
export interface ResolveResult {
  /** Whether the loop is settled or still needs user input. TODO: refine. */
  outcome: "stable" | "needsInput";
  // TODO: resolved requirements, clashes, user choices, planned actions, summary.
}
