import { MOD_TYPE } from "../constants";
import { importTweaks } from "../initweaks";
import { IINITweak } from "../types/IINITweak";
import { createCollection } from "./createCollection";
import { makeCollectionId, validateName } from "./transformCollection";

import * as _ from "lodash";
import * as Redux from "redux";
import { generate as shortid } from "shortid";
import { actions, types, util } from "vortex-api";

async function createTweaksFromProfile(
  api: types.IExtensionApi,
  profile: types.IProfile,
  mods: { [modId: string]: types.IMod },
  existingId: string,
): Promise<IINITweak[]> {
  return importTweaks(
    api,
    profile,
    api.getState().persistent.mods[profile.gameId],
    api.getState().persistent.mods[profile.gameId]?.[existingId],
  );
}

function createRulesFromProfile(
  profile: types.IProfile,
  mods: { [modId: string]: types.IMod },
  existingRules: types.IModRule[],
  existingId: string,
  filterFunc: (mod: types.IMod) => boolean,
  isQuickCollection?: boolean,
): types.IModRule[] {
  return Object.keys(profile.modState ?? {})
    .filter(
      (modId) =>
        profile.modState?.[modId]?.enabled &&
        mods[modId] !== undefined &&
        modId !== existingId &&
        // no nested collections allowed
        mods[modId].type !== MOD_TYPE &&
        filterFunc(mods[modId]),
    )
    .map((modId) => {
      // don't forget what we set up regarding version matching
      let versionMatch: string;

      const oldRule = existingRules.find((iter) =>
        util.testModReference(mods[modId], iter.reference),
      );
      if (
        oldRule !== undefined &&
        oldRule.reference.versionMatch !== undefined
      ) {
        versionMatch =
          oldRule.reference.versionMatch === "*"
            ? "*"
            : mods[modId].attributes.version;
      }

      if (isQuickCollection) {
        versionMatch = mods[modId].attributes.version;
      }

      return {
        type: "requires",
        reference: {
          id: modId,
          archiveId: mods[modId].archiveId,
          versionMatch,
        },
      } as any;
    });
}

function updateCollection(
  api: types.IExtensionApi,
  gameId: string,
  mod: types.IMod,
  newRules: types.IModRule[],
) {
  api.store.dispatch(actions.setModAttribute(gameId, mod.id, "editable", true));

  const removedRules: types.IModRule[] = [];
  // remove rules not found in newRules
  util.batchDispatch(
    api.store,
    (mod.rules ?? []).reduce((prev: Redux.Action[], rule: types.IModRule) => {
      if (newRules.find((iter) => _.isEqual(rule, iter)) === undefined) {
        removedRules.push(rule);
        prev.push(actions.removeModRule(gameId, mod.id, rule));
      }
      return prev;
    }, []),
  );

  // add rules not found in the old list
  util.batchDispatch(
    api.store,
    newRules.reduce((prev: Redux.Action[], rule: types.IModRule) => {
      if (
        (mod.rules ?? []).find((iter) => _.isEqual(rule, iter)) === undefined
      ) {
        prev.push(actions.addModRule(gameId, mod.id, rule));
      }
      return prev;
    }, []),
  );
}

interface ICreateCollectionFromProfileResult {
  id: string;
  name: string;
  updated: boolean;
  wantsToUpload: boolean;
}

export async function createCollectionFromProfile(
  api: types.IExtensionApi,
  profileId: string,
  forceName?: string,
): Promise<ICreateCollectionFromProfileResult> {
  const state: types.IState = api.store.getState();
  const profile = state.persistent.profiles[profileId];

  const isQuickCollection = forceName !== undefined;
  const id = isQuickCollection
    ? makeCollectionId(`${profileId}_${shortid()}`)
    : makeCollectionId(profileId);

  const mod: types.IMod = state.persistent.mods[profile.gameId]?.[id];

  const isNexusSourced = (m: types.IMod) => m?.attributes?.source === "nexus";
  const isGeneratedMod = (m: types.IMod) => m?.attributes?.generated === true;
  const filterFunc = (m: types.IMod) =>
    forceName ? isNexusSourced(m) && !isGeneratedMod(m) : true;
  const rules = createRulesFromProfile(
    profile,
    state.persistent.mods[profile.gameId] ?? {},
    mod?.rules ?? [],
    mod?.id,
    filterFunc,
    isQuickCollection,
  );

  let name: string = forceName ?? profile.name;

  const uploadLabel = "Create and Upload";
  let wantsToUpload = false;
  if (mod === undefined) {
    const t = api.translate;
    const result = await api.showDialog(
      "question",
      "New collection from profile",
      {
        text: "Create a collection containing the mods enabled in your current profile.",
        input: [
          {
            id: "name",
            label: "Please enter a name for your new collection",
            type: "text",
            value: name,
          },
        ],
        condition: (content) => validateName(t, content),
      },
      [
        { label: "Cancel" },
        { label: forceName ? uploadLabel : "Create", default: true },
      ],
    );

    const cancelled = result.action === "Cancel";
    if (cancelled) {
      throw new util.UserCanceled();
    }

    wantsToUpload = result.action === uploadLabel;

    name = result.input["name"];
    await createCollection(api, profile.gameId, id, name, rules);
    await createTweaksFromProfile(
      api,
      profile,
      state.persistent.mods[profile.gameId] ?? {},
      id,
    );

    const userInfo = state.persistent["nexus"]?.userInfo;
    if (userInfo?.userId) {
      const game = util.getGame(profile.gameId);
      const creationMethod = isQuickCollection
        ? "quick_collection"
        : "from_profile";
      api.events.emit("analytics-track-mixpanel-event", {
        eventName: "collection_drafted",
        properties: {
          collection_name: name,
          game_name: game.name,
          creation_method: creationMethod,
        },
      });
    }
  } else {
    name = mod.attributes?.name;
    updateCollection(api, profile.gameId, mod, rules);
  }

  return { id, name, updated: mod !== undefined, wantsToUpload };
}
