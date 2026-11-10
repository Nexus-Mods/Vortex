import type { PlannedDestination } from "@nexusmods/mod-pipeline";
import type { VortexGameId } from "@vortex/shared";

/** A game's last plan run: every destination as the planner left it. */
export interface LastPlan {
  plannedAt: Temporal.Instant;
  destinations: readonly PlannedDestination[];
}

// by game, in memory only: a plan lists every destination of a setup, too many to persist
const lastPlanByGame = new Map<VortexGameId, LastPlan>();
const listeners = new Set<() => void>();

/** Notifies `listener` whenever a game's last plan is replaced; returns the unsubscribe. */
export function subscribeToLastPlans(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function lastPlanOf(gameId: VortexGameId): LastPlan | undefined {
  return lastPlanByGame.get(gameId);
}

export function keepLastPlan(gameId: VortexGameId, lastPlan: LastPlan): void {
  lastPlanByGame.set(gameId, lastPlan);
  listeners.forEach((listener) => listener());
}
