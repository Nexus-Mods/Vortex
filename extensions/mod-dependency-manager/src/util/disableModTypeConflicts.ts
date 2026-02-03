/* eslint-disable */
import { actions, selectors, types, util } from "vortex-api";
import { setModTypeConflictsSetting } from "../actions";

const getNonDefaultModTypes = (mod: types.IMod) => {
  return mod?.type !== "";
};

const allRules = (
  graph: types.IMod[],
): { [sourceId: string]: types.IModRule[] } => {
  return graph.reduce((accum, val) => {
    if (val.rules !== undefined && val.rules.length > 0) {
      accum[val.id] = val.rules;
    }
    return accum;
  }, {});
};

const findModsByRules = (mod, modsMap) => {
  const mods = (mod.rules ?? []).reduce((accum, iter) => {
    const modByRef = modsMap[iter.reference.id];
    if (
      modByRef !== undefined &&
      util.testModReference(modByRef, iter.reference)
    ) {
      accum.push(iter);
    }
    return accum;
  }, []);
  return mods;
};

async function findAffectedMods(api: types.IExtensionApi, gameId: string) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", gameId],
    {},
  );
  const graph: types.IMod[] = Object.values(mods).map((m) => m);
  const graphRules = allRules(graph);
  const nonDefaultMods = graph.filter(getNonDefaultModTypes);
  const affectedMods = nonDefaultMods.reduce((accum, mod) => {
    for (const [sourceId, rules] of Object.entries(graphRules)) {
      const matchingRules = rules.filter(
        (rule) =>
          mods[sourceId].type !== mod.type &&
          util.testModReference(mod, rule.reference),
      );
      if (matchingRules.length > 0) {
        if ((mod.fileOverrides ?? []).length > 0) {
          accum[mod.id] = util.renderModName(mod);
        }
        if (
          sourceId !== mod.id &&
          (mods[sourceId]?.fileOverrides ?? []).length > 0
        ) {
          accum[sourceId] = util.renderModName(mod);
        }
      }
    }
    return accum;
  }, {});

  return affectedMods;
}

export async function disableModTypeConflictsDialog(api: types.IExtensionApi) {
  const t = api.translate;
  const gameId = selectors.activeGameId(api.getState());
  const relevant = await findAffectedMods(api, gameId);
  const checkboxes =
    Object.keys(relevant).length > 0
      ? [
          {
            id: "remove_file_overrides",
            text: t("Remove file overrides"),
            value: true,
          },
        ]
      : undefined;
  const message =
    Object.keys(relevant).length > 0
      ? t(
          "You have {{total}} mod(s) with file overrides that are involved in a modtype conflict:\n",
          { replace: { total: Object.keys(relevant).length } },
        ) + Object.values(relevant).join("\n")
      : undefined;
  const res: types.IDialogResult | undefined = await api?.showDialog?.(
    "question",
    "Disabling Cross-ModType Conflicts",
    {
      bbcode: t(
        "You are about to disable cross-modtype conflicts - this is not recommended as conflicts across mod types " +
          "do not adhere to regular deployment rules and are guaranteed to break your modding environment when present.[br][/br][br][/br]" +
          "If you proceed, and you have such conflicts, the external changes dialog will be raised " +
          "after each deployment/purge event until you manually remove the conflicting files or disable " +
          "the mods that are causing the conflict.[br][/br][br][/br]" +
          "By default, Vortex will now clear any file overrides that were created to resolve cross-modtype conflicts. Please be aware " +
          "that ALL file overrides will be removed from the mods mentioned below. " +
          "Uncheck the box if you would rather keep these file overrides and manage them manually.",
      ),
      message,
      checkboxes,
      options: { order: ["bbcode", "checkboxes", "message"] },
    },
    [{ label: "Cancel" }, { label: "Proceed" }],
    "dependency-manager-disable-modtype-conflicts-dialog",
  );
  if (res === undefined || res?.action === "Cancel") {
    throw new util.UserCanceled();
  }

  let batchedActions = [setModTypeConflictsSetting(false)];
  const removeOverrides = res.input?.remove_file_overrides;
  if (removeOverrides) {
    const overrideActions: any[] = Object.keys(relevant).map((id) =>
      actions.setFileOverride(gameId, id, []),
    );
    batchedActions = batchedActions.concat(overrideActions);
  }
  util.batchDispatch(api.store, batchedActions);
}
