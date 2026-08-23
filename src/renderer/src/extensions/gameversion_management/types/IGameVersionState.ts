export type GameVersionJobPhase = "planning" | "patching" | "committing";

export interface IGameVersionJob {
  gameId: string;
  targetVersion: string;
  phase: GameVersionJobPhase;
  progress: number;
}

export interface IGameVersionSessionState {
  jobs: Record<string, IGameVersionJob>;
}
