import * as _ from "lodash";
import type { IRule } from "modmeta-db";

import type { IReducerSpec } from "../../../types/IExtensionContext";
import { VerifierDropParent } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";
import { removeValue } from "../../../util/storeHelper";
import {
  deleteOrNop,
  getSafe,
  merge,
  pushSafe,
  removeValueIf,
  setSafe,
} from "../../../util/storeHelper";
import * as actions from "../actions/mods";
import type { IMod } from "../types/IMod";
import { referenceEqual } from "../util/testModReference";

// A modId is unusable as a staging-folder name if it was corrupted by an
// external state clobber - the installationPath self-heal uses this to tell a
// recoverable key from rubbish. U+FFFD is what a UTF-8 decode
// of clobbered key bytes yields; anything below U+0020 is a C0 control char.
// Either means the key can't name a real folder on disk.
function isUnusableModId(modId: string): boolean {
  for (let i = 0; i < modId.length; ++i) {
    const code = modId.charCodeAt(i);
    if (code === 0xfffd || code < 0x20) {
      return true;
    }
  }
  return false;
}

function reduceRule(input: IRule): IRule {
  if (input === undefined) {
    return undefined;
  }
  return {
    type: input.type,
    reference: _.omit(
      _.pickBy(input.reference, (i) => i !== undefined),
      ["archiveId", "description", "instructions"],
    ),
  };
}

function ruleEqual(lhs: IRule, rhs: IRule) {
  return _.isEqual(reduceRule(lhs), reduceRule(rhs));
}

/**
 * reducer for changes to the known mods
 */
export const modsReducer: IReducerSpec = {
  reducers: {
    [actions.addMod as any]: (state, payload) => {
      const { gameId, mod } = payload;
      return setSafe(state, [gameId, mod.id], mod);
    },
    [actions.addMods as any]: (state, payload) => {
      const { gameId, mods } = payload;
      const modDict = mods.reduce((prev: { [key: string]: IMod }, value: IMod) => {
        prev[value.id] = value;
        return prev;
      }, {});
      return merge(state, [gameId], modDict);
    },
    [actions.removeMod as any]: (state, payload) => {
      const { gameId, modId } = payload;
      return deleteOrNop(state, [gameId, modId]);
    },
    [actions.setModArchiveId as any]: (state, payload) => {
      const { gameId, modId, archiveId } = payload;
      return setSafe(state, [gameId, modId, "archiveId"], archiveId);
    },
    [actions.setModInstallationPath as any]: (state, payload) => {
      const { gameId, modId, installPath } = payload;
      if (state[gameId] === undefined || state[gameId][modId] === undefined) {
        return state;
      }
      return setSafe(state, [gameId, modId, "installationPath"], installPath);
    },
    [actions.setModState as any]: (state, payload) => {
      const { gameId, modId, modState } = payload;
      if (state[gameId] === undefined || state[gameId][modId] === undefined) {
        return state;
      }
      return setSafe(state, [gameId, modId, "state"], modState);
    },
    [actions.setModAttribute as any]: (state, payload) => {
      const { gameId, modId, attribute, value } = payload;
      if (state[gameId] === undefined || state[gameId][modId] === undefined) {
        return state;
      }
      if (value === undefined) {
        return deleteOrNop(state, [gameId, modId, "attributes", attribute]);
      } else {
        return setSafe(state, [gameId, modId, "attributes", attribute], value);
      }
    },
    [actions.setModAttributes as any]: (state, payload) => {
      const { gameId, modId, attributes } = payload;
      if (state[gameId] === undefined || state[gameId][modId] === undefined) {
        return state;
      }
      return merge(state, [gameId, modId, "attributes"], attributes);
    },
    [actions.setModType as any]: (state, payload) => {
      const { gameId, modId, type } = payload;
      if (getSafe(state, [gameId, modId], undefined) === undefined) {
        return state;
      }
      return setSafe(state, [gameId, modId, "type"], type);
    },
    [actions.clearModRules as any]: (state, payload) => {
      const { gameId, modId } = payload;
      if (state[gameId] === undefined || state[gameId][modId] === undefined) {
        return state;
      }
      return setSafe(state, [gameId, modId, "rules"], []);
    },
    [actions.addModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;
      if (state[gameId] === undefined || state[gameId][modId] === undefined) {
        log("warn", "tried to add mod rule to mod that isn't installed", {
          gameId,
          modId,
        });
        return state;
      }
      const filteredRef = _.omitBy(rule.reference, _.isUndefined);

      // mutually exclusive types replace each other, so if we add a "before"
      // rule we first remove any existing "after" rule with the same reference
      const typeGroups = [
        ["after", "before"],
        ["requires", "recommends"],
      ];
      let group = typeGroups.find((grp) => grp.indexOf(rule.type) !== -1);
      if (group === undefined) {
        group = [rule.type];
      }

      const idx = getSafe(state, [gameId, modId, "rules"], []).findIndex((iterRule: IRule) => {
        const typeMatch = group.indexOf(rule.type) !== -1;
        const filteredIter = _.omitBy(iterRule.reference, _.isUndefined);
        return typeMatch && referenceEqual(filteredRef, filteredIter);
      });

      if (idx !== -1) {
        return setSafe(state, [gameId, modId, "rules", idx], rule);
      } else {
        return pushSafe(state, [gameId, modId, "rules"], rule);
      }
    },
    [actions.removeModRule as any]: (state, payload) => {
      const { gameId, modId, rule } = payload;

      if (state[gameId]?.[modId] === undefined) {
        return state;
      }

      return removeValueIf(state, [gameId, modId, "rules"], (iterRule: IRule) =>
        ruleEqual(iterRule, rule),
      );
    },
    [actions.cacheModReference as any]: (state, payload) => {
      const { gameId, modId, reference, refModId } = payload;

      if (state[gameId]?.[modId] === undefined) {
        return state;
      }

      const indices: number[] = [];
      const rules: IRule[] = getSafe(state, [gameId, modId, "rules"], []);
      for (let i = 0; i < rules.length; ++i) {
        if (referenceEqual(rules[i].reference, reference)) {
          indices.push(i);
        }
      }
      indices.forEach((idx) => {
        state = setSafe(state, [gameId, modId, "rules", idx, "reference", "idHint"], refModId);
      });
      return state;
    },
    [actions.setINITweakEnabled as any]: (state, payload) => {
      const { gameId, modId, tweak, enabled } = payload;

      if (state[gameId]?.[modId] === undefined) {
        return state;
      }

      return enabled
        ? pushSafe(state, [gameId, modId, "enabledINITweaks"], tweak)
        : removeValue(state, [gameId, modId, "enabledINITweaks"], tweak);
    },
    [actions.setFileOverride as any]: (state, payload) => {
      const { gameId, modId, files } = payload;
      if (!Array.isArray(files)) {
        // this should never happen
        return state;
      }
      if (state[gameId]?.[modId] === undefined) {
        return state;
      }
      const hasInvalidEntry = files.find((file) => typeof file !== "string") !== undefined;
      if (hasInvalidEntry) {
        return state;
      }

      return setSafe(state, [gameId, modId, "fileOverrides"], files);
    },
  },
  defaults: {},
  verifiers: {
    _: {
      type: "object",
      description: () => "Severe! Corrupted mod list",
      // only delete the individual corrupt game entry, never propagate upward
      // to avoid wiping the entire persistent.mods tree
      deleteBroken: true,
      elements: {
        _: {
          type: "object",
          description: () => "Corrupted mod info will be reset",
          deleteBroken: true,
          elements: {
            installationPath: {
              type: "string",
              description: () =>
                "Mod with invalid installationPath will be self-healed from its id.",
              noUndefined: true,
              noNull: true,
              noEmpty: true,
              required: true,
              // Self-heal instead of discarding the whole mod (GH#23363/#23355).
              // installationPath is the staging-folder name, which by convention
              // equals the modId - and the modId is this record's map key, still
              // present even when the installationPath leaf was lost to a partial
              // write. Recovering it preserves the mod's archiveId, attributes and
              // rules instead of orphaning the staging folder and splitting the
              // mod from its download. Only drop the record if the modId itself is
              // unusable - i.e. missing/empty, or corrupted by an external state
              // clobber into a name that can't name a real staging folder (a torn
              // write / bit-rot leaves U+FFFD replacement chars or control chars,
              // producing a phantom that would otherwise nag "Mods changed on
              // disk" every launch.
              repair: (_input, _def, context) => {
                const modId = context?.parentKey;
                if (typeof modId === "string" && modId.length > 0 && !isUnusableModId(modId)) {
                  return modId;
                }
                throw new VerifierDropParent();
              },
            },
            attributes: {
              type: "object",
              description: () => "",
              elements: {
                newestChangelog: {
                  type: "object",
                  description: () => "Corrupted mod changelog will be reset",
                  deleteBroken: true,
                },
                version: {
                  type: "string",
                  description: () => "Corrupted mod version will be reset",
                  deleteBroken: true,
                },
                downloadGame: {
                  type: "string",
                  description: () => "Invalid download game id will be fixed",
                  repair: (input) => (Array.isArray(input) ? input[0] : undefined),
                },
              },
            },
          },
        },
      },
    },
  },
};
