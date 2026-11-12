import { z } from "../zodJitless";

// NOTE(erri120): explicit casting with `as z.ZodType<>` required for `--isolatedDeclarations` to work
// Prefix flags with "vortex-" to qualify it within the shared Unleash application; the name must match the toggle configured in Unleash.
export const flagVariantSchemas = {
  "vortex-test-flag": {
    "variant-1": z.coerce.number() as z.ZodType<number>,
    "variant-2": z.coerce.number() as z.ZodType<number>,
    "variant-3": z
      .string()
      .transform((s: string) => JSON.parse(s) as unknown)
      .pipe(z.object({ foo: z.string() })) as z.ZodType<{ foo: string }>,
  },
  // On/off gate for the file-level requirements health check (no variants).
  "vortex-file-requirements-health-check": {},
  // On/off gate for Tier 0 game support (games managed without a game extension).
  "vortex-tier-0-game-support": {},
  // On/off gate for browsing mods on the Browse page; off shows a coming-soon panel instead.
  "laz-vortex-browse-mods": {},
  // Gate for the Steam game folder check (MOD-80). The optional "config" variant
  // overrides its defaults, so limits can change without a release.
  "vortex-game-folder-check": {
    config: z
      .string()
      .transform((s: string) => JSON.parse(s) as unknown)
      .pipe(
        z.object({
          settleMs: z.number().nonnegative().optional(),
          maxDurationMs: z.number().positive().optional(),
          maxBytes: z.number().positive().optional(),
          hashConcurrency: z.number().int().positive().optional(),
          hashSampleExecutables: z.number().int().nonnegative().optional(),
          hashSampleFiles: z.number().int().nonnegative().optional(),
          maxUnknownPaths: z.number().int().nonnegative().optional(),
          fullVerifyPercent: z.number().min(0).max(100).optional(),
        }),
      ) as z.ZodType<GameFolderCheckFlagConfig>,
  },
};

export interface GameFolderCheckFlagConfig {
  settleMs?: number;
  maxDurationMs?: number;
  maxBytes?: number;
  hashConcurrency?: number;
  hashSampleExecutables?: number;
  hashSampleFiles?: number;
  maxUnknownPaths?: number;
  fullVerifyPercent?: number;
}

type FlagVariantSchemas = typeof flagVariantSchemas;
export type KnownFlagName = keyof FlagVariantSchemas;
export const knownFlagNames: ReadonlySet<string> = new Set(Object.keys(flagVariantSchemas));

type FlagVariantUnion<TVariants extends Record<string, z.ZodType>> = keyof TVariants extends never
  ? never
  : {
      [K in keyof TVariants]: { name: K; data: z.infer<TVariants[K]> };
    }[keyof TVariants];

export type FeatureFlag = {
  [K in keyof FlagVariantSchemas]: FlagVariantUnion<FlagVariantSchemas[K]> extends never
    ? {
        name: K;
        variant?: undefined;
      }
    : {
        name: K;
        variant?: FlagVariantUnion<FlagVariantSchemas[K]>;
      };
}[keyof FlagVariantSchemas];
