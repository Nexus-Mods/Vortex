import { selectors, types, util } from "vortex-api";
import { setConflictDialog } from "../actions";
import { IBiDirRule } from "../types/IBiDirRule";
import { findRuleBiDir, isConflictResolved } from "./findRule";

function showUnsolvedConflictsDialog(
  api: types.IExtensionApi,
  modRules: IBiDirRule[],
  showAll?: boolean,
  gameId?: string,
) {
  const state: types.IState = api.store.getState();
  if (gameId === undefined) {
    gameId = selectors.activeGameId(state);
  }
  const mods = state.persistent.mods[gameId] ?? {};

  const conflicts = util.getSafe(
    state.session,
    ["dependencies", "conflicts"],
    undefined,
  );

  if (conflicts === undefined) {
    api.sendNotification({
      type: "info",
      id: "conflicts-not-calculated",
      message: "Conflicts haven't been calculated yet, please wait a moment",
      displayMS: 5000,
    });
    return;
  }

  let modsToShow = Object.keys(conflicts);

  if (!showAll) {
    const encountered = new Set<string>();
    const mapEnc = (lhs: string, rhs: string) => [lhs, rhs].sort().join(":");
    modsToShow = modsToShow.filter(
      (modId) =>
        conflicts[modId].find((conflict) => {
          if (conflict.otherMod === undefined) {
            return false;
          }
          const encKey = mapEnc(modId, conflict.otherMod.id);
          if (encountered.has(encKey)) {
            return false;
          }
          encountered.add(encKey);
          return (
            !isConflictResolved(mods, modId, conflict.otherMod) &&
            findRuleBiDir(modRules, mods[modId], conflict.otherMod) ===
              undefined
          );
        }) !== undefined,
    );
  }

  if (modsToShow.length > 0 || showAll) {
    api.store.dispatch(setConflictDialog(gameId, modsToShow, modRules));
  }
}

export default showUnsolvedConflictsDialog;
