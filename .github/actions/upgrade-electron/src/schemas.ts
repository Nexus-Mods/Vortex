import { z } from "zod";

/** An entry of https://releases.electronjs.org/releases.json (only the fields used here). */
export const electronReleaseSchema = z.object({
  /** Electron version, e.g. "45.1.0". */
  version: z.string(),
  /** Node.js version bundled with this Electron release. */
  node: z.string(),
  /** Release date, e.g. "2026-10-27". */
  date: z.string(),
  /** Release timestamp (ISO 8601), more precise than `date`. */
  fullDate: z.string().optional(),
});

export type ElectronRelease = z.infer<typeof electronReleaseSchema>;

export const electronReleasesSchema = z.array(electronReleaseSchema);

/** The npm registry document of a package (only the fields used here). */
export const npmPackumentSchema = z.object({
  /** Keyed by version. */
  versions: z.record(z.string(), z.unknown()),
  /** Publish timestamps keyed by version (plus "created" and "modified"). */
  time: z.record(z.string(), z.string()),
});

export type NpmPackument = z.infer<typeof npmPackumentSchema>;

/** The Node.js pins in package.json. */
export const packageJsonNodePinsSchema = z.object({
  engines: z.object({
    node: z.string(),
    runtime: z.object({ version: z.string() }),
  }),
  devEngines: z.object({
    runtime: z.object({ version: z.string() }),
  }),
});
