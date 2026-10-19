import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** The fields of an installed mod (Vortex's IMod) the resolver reads. */
export interface IMod {
  /** absolute paths this mod leaves to earlier mods */
  fileOverrides?: string[];
  attributes?: { source?: string; fileId?: number | string };
}

/** The fields of a profile (Vortex's IProfile) the resolver reads. */
export interface IProfile {
  /** keyed by mod id */
  modState: Record<string, { enabled: boolean }>;
}

/** The subset of Vortex's IState the resolver reads, at the same paths. */
export interface IState {
  persistent: {
    /** keyed by game id, then mod id */
    mods: Record<string, Record<string, IMod>>;
    /** keyed by profile id */
    profiles: Record<string, IProfile>;
  };
  settings: {
    /** lastActiveProfile is keyed by game id */
    profiles: { lastActiveProfile: Record<string, string> };
  };
}

const modSchema = z.object({
  fileOverrides: z.array(z.string()).optional(),
  attributes: z
    .object({
      source: z.string().optional(),
      fileId: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

const stateSchema = z.object({
  persistent: z.object({
    mods: z.record(z.string(), z.record(z.string(), modSchema)),
    profiles: z.record(
      z.string(),
      z.object({
        modState: z.record(z.string(), z.object({ enabled: z.boolean() })),
      }),
    ),
  }),
  settings: z.object({
    profiles: z.object({ lastActiveProfile: z.record(z.string(), z.string()) }),
  }),
});

// typecheck fails when the schema and its type drift apart
type _StateMatches = Assert<MutuallyAssignable<z.infer<typeof stateSchema>, IState>>;

export const StateSchema: z.ZodType<IState> = stateSchema;
