import type { types } from "@nexusmods/vortex-api";
import { VortexModId } from "@vortex/shared";
import * as _ from "lodash";

import type { IConflict } from "../types/IConflict";
import { topologicalSort } from "./topologicalSort";

export type FileOverridesByMod = Record<VortexModId, string[]>;

interface IOverridePlan {
  changes: FileOverridesByMod;
  // mod types deploy one after another, so moving a file between them needs a clean slate
  purgeFirst: boolean;
}

const enabledConflicts = (
  modId: VortexModId,
  enabledModIds: ReadonlySet<VortexModId>,
  conflicts: Record<VortexModId, IConflict[]>,
) => (conflicts[modId] ?? []).filter((c) => enabledModIds.has(VortexModId(c.otherMod.id)));

function crossTypeConflicts(
  modId: VortexModId,
  mods: Record<VortexModId, types.IMod>,
  enabledModIds: ReadonlySet<VortexModId>,
  conflicts: Record<VortexModId, IConflict[]>,
): IConflict[] {
  const modType = mods[modId]?.type;
  return enabledConflicts(modId, enabledModIds, conflicts).filter(
    (c) => mods[VortexModId(c.otherMod.id)]?.type !== modType,
  );
}

/** One mod deploys each shared file: the one already deploying it, else the one the load order puts last. */
function resolveFileOverrides(
  mods: Record<VortexModId, types.IMod>,
  enabledModIds: ReadonlySet<VortexModId>,
  conflicts: Record<VortexModId, IConflict[]>,
): FileOverridesByMod {
  const enabledMods = Object.values(mods).filter((mod) => enabledModIds.has(VortexModId(mod.id)));
  const resolved = new Map<VortexModId, Set<string>>();
  const overridesOf = (modId: VortexModId) => {
    let overrides = resolved.get(modId);
    if (overrides === undefined) {
      overrides = new Set(mods[modId]?.fileOverrides ?? []);
      resolved.set(modId, overrides);
    }
    return overrides;
  };
  const solved = new Set<string>();

  for (const mod of enabledMods.filter((m) => (m.fileOverrides ?? []).length > 0)) {
    const modId = VortexModId(mod.id);
    const partnersByFile = new Map<string, VortexModId[]>();
    for (const conflict of enabledConflicts(modId, enabledModIds, conflicts)) {
      for (const file of conflict.files) {
        const partners = partnersByFile.get(file) ?? [];
        partners.push(VortexModId(conflict.otherMod.id));
        partnersByFile.set(file, partners);
      }
    }
    // an override is only needed for a file another enabled mod deploys too
    const overrides = overridesOf(modId);
    for (const file of overrides) {
      if (!partnersByFile.has(file)) {
        overrides.delete(file);
      }
    }

    for (const [file, partners] of partnersByFile) {
      if (solved.has(file)) {
        continue;
      }
      solved.add(file);
      const sharing = enabledMods.filter(
        (m) => m.id === modId || partners.includes(VortexModId(m.id)),
      );
      const deployers = sharing.filter((m) => !overridesOf(VortexModId(m.id)).has(file));
      if (deployers.length === 1) {
        continue;
      }
      const [winner, ...losers] = topologicalSort(sharing).map((id) => VortexModId(id));
      overridesOf(winner).delete(file);
      losers.forEach((loser) => overridesOf(loser).add(file));
    }
  }

  return Object.fromEntries(Array.from(resolved, ([modId, files]) => [modId, Array.from(files)]));
}

export function planOverrideUpdate(
  mods: Record<VortexModId, types.IMod>,
  enabledModIds: ReadonlySet<VortexModId>,
  conflicts: Record<VortexModId, IConflict[]>,
  edits: FileOverridesByMod,
): IOverridePlan {
  const edited = Object.keys(edits).length === 0 ? mods : { ...mods };
  for (const [modId, files] of Object.entries(edits)) {
    edited[modId] = { ...mods[modId], fileOverrides: files };
  }
  const changes: FileOverridesByMod = Object.fromEntries(
    Object.entries({ ...edits, ...resolveFileOverrides(edited, enabledModIds, conflicts) }).filter(
      ([modId, files]) => _.xor(files, mods[modId]?.fileOverrides ?? []).length > 0,
    ),
  );
  const purgeFirst = Object.keys(changes).some(
    (modId) => crossTypeConflicts(VortexModId(modId), mods, enabledModIds, conflicts).length > 0,
  );
  return { changes, purgeFirst };
}

export function hasModTypeConflictOverrides(
  mods: Record<VortexModId, types.IMod>,
  enabledModIds: ReadonlySet<VortexModId>,
  conflicts: Record<VortexModId, IConflict[]>,
): boolean {
  return Array.from(enabledModIds).some((modId) => {
    const fileOverrides = mods[modId]?.fileOverrides ?? [];
    if (fileOverrides.length === 0) {
      return false;
    }
    const overrides = new Set(fileOverrides);
    return crossTypeConflicts(modId, mods, enabledModIds, conflicts).some((c) =>
      c.files.some((file) => overrides.has(file)),
    );
  });
}
