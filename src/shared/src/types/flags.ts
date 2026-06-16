import { z } from "zod";

// NOTE(erri120): explicit casting with `as z.ZodType<>` required for `--isolatedDeclarations` to work
export const flagVariantSchemas = {
  "vortex-test-flag": {
    "variant-1": z.coerce.number() as z.ZodType<number>,
    "variant-2": z.coerce.number() as z.ZodType<number>,
    "variant-3": z
      .string()
      .transform((s: string) => JSON.parse(s) as unknown)
      .pipe(z.object({ foo: z.string() })) as z.ZodType<{ foo: string }>,
  },
};

type FlagVariantSchemas = typeof flagVariantSchemas;
export type KnownFlagName = keyof FlagVariantSchemas;
export const knownFlagNames: ReadonlySet<string> = new Set(Object.keys(flagVariantSchemas));

type FlagVariantUnion<TVariants extends Record<string, z.ZodType>> = {
  [K in keyof TVariants]: { name: K; data: z.infer<TVariants[K]> };
}[keyof TVariants];

export type FeatureFlag = {
  [K in keyof FlagVariantSchemas]: {
    name: K;
    variant?: FlagVariantUnion<FlagVariantSchemas[K]>;
  };
}[keyof FlagVariantSchemas];
