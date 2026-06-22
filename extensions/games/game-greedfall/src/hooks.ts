/**
 * Imperative hooks for the GreedFall GDL extension. The declarative parts live
 * in game.yaml; this file holds the three things GDL cannot express
 * declaratively:
 *
 *   - installGreedfallMod: the catch-all mod installer. GreedFall archives that
 *     wrap their payload in a `datalocal` folder must be re-rooted at that
 *     segment (so the game's own folder structure is not duplicated under
 *     datalocal/datalocal/...); archives without a `datalocal` segment are
 *     copied as-is. FOMOD archives are excluded by the installer's `unless`
 *     predicate, so this hook only sees non-FOMOD content.
 *   - detectGameVersion: reads the product version from GreedFall.exe via the
 *     `exe-version` package. Referenced by game.yaml's
 *     `discovery.version: { hook: detectGameVersion }`.
 *   - didDeploy: after every deploy, bumps the modified time of each deployed
 *     file to "now" so the game reloads them. Referenced by game.yaml's
 *     `events.did-deploy: { hook: didDeploy }`.
 */
import * as path from "path";

import { fs, selectors, types } from "@nexusmods/vortex-api";
import { getProductVersionLocalized } from "exe-version";

/**
 * The discovery context the GDL runtime passes to `detectGameVersion`. Mirrors
 * the runtime's GameContext (DiscoveryFacts); declared inline so the hook stays
 * self-contained and doesn't depend on the `@gdl/runtime` alias (which only the
 * webpack bundle resolves, not the standalone type-check / test run).
 */
interface GameContext {
  installPath: string;
}

const GAME_ID = "greedfall";
const EXECUTABLE = "GreedFall.exe";
const MOD_PATH_SEGMENT = "datalocal";

/** An archive entry is a directory when it ends in a path separator. */
const isDir = (file: string): boolean => file.endsWith("/") || file.endsWith("\\");

/**
 * Re-root every archive entry at its `datalocal` path segment
 * (case-insensitive): if a path segment equals `datalocal`, drop everything up
 * to and including it; otherwise keep the path unchanged. Directory entries
 * become `mkdir` instructions, files become `copy` instructions. Mirrors the
 * original extension's `installMod`.
 */
export async function installGreedfallMod(
  files: string[],
  _destinationPath: string,
): Promise<types.IInstallResult> {
  const instructions: types.IInstruction[] = files.map((file) => {
    const segments = file.split(/[\\/]/);
    const offset = segments.findIndex((seg) => seg.toLowerCase() === MOD_PATH_SEGMENT);
    const outPath = offset !== -1 ? segments.slice(offset + 1).join(path.sep) : file;

    if (isDir(file)) {
      return { type: "mkdir" as const, destination: outPath };
    }
    return { type: "copy" as const, source: file, destination: outPath };
  });

  return { instructions };
}

/**
 * Return GreedFall.exe's localized product version. `exe-version` parses the PE
 * resource synchronously; resolve it into the Promise the catalog signature
 * requires. Returns null if the exe can't be read so version detection degrades
 * gracefully (the runtime treats a null/throw as "no version").
 */
export async function detectGameVersion(ctx: GameContext): Promise<string | null> {
  try {
    return getProductVersionLocalized(path.join(ctx.installPath, EXECUTABLE));
  } catch {
    return null;
  }
}

/**
 * `did-deploy` handler: after deployment, set the modified time (utimes) of
 * every deployed file to "now" so the game reloads them. Mirrors the original
 * extension's `did-deploy` listener, including the gameId guard (the runtime
 * fires this for every `did-deploy` event regardless of active game).
 */
export async function didDeploy(ctx: {
  profileId: string;
  deployment: unknown;
  api: unknown;
}): Promise<void> {
  const api = ctx.api as types.IExtensionApi;
  const state = api.store?.getState();
  if (state === undefined) return;

  const profile = selectors.profileById(state, ctx.profileId);
  if (profile?.gameId !== GAME_ID) return;

  const discovery = selectors.discoveryByGame(state, profile.gameId);
  if (discovery?.path === undefined) return;
  const modDeployPath = path.join(discovery.path, MOD_PATH_SEGMENT);

  // The deployment is a map of modType -> deployed files; the default modType
  // (empty-string key) holds GreedFall's mods. Each entry carries a relPath
  // relative to the deploy target.
  const deployment = ctx.deployment as Record<string, Array<{ relPath: string }>>;
  const files = deployment?.[""] ?? [];

  const now = new Date();
  try {
    await Promise.all(
      files.map((file) => fs.utimesAsync(path.join(modDeployPath, file.relPath), now, now)),
    );
  } catch (err) {
    api.showErrorNotification?.("Failed to change file access/modified time", err, {
      allowReport: false,
    });
  }
}
