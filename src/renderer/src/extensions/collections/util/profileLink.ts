import { type VortexProfileId, toVortexModId, type VortexModId } from "@vortex/shared";
import { generate as shortid } from "shortid";

import * as actions from "../../../actions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import * as selectors from "../../../util/selectors";
import { batchDispatch } from "../../../util/util";
import type { IMod } from "../../mod_management/types/IMod";
import renderModName from "../../mod_management/util/modName";
import { MOD_TYPE } from "../constants";
import { makeCollectionId } from "./transformCollection";

export interface IProfileLinkChange {
  collectionId: VortexModId;
  associatedProfile: VortexProfileId | undefined;
}

const isEditableCollectionMod = (mod: IMod | undefined): boolean =>
  mod?.type === MOD_TYPE && mod.attributes?.editable === true;

// A collection id no other collection holds, for a new collection made from the profile.
export const freshCollectionId = (profileId: VortexProfileId): VortexModId =>
  toVortexModId(makeCollectionId(`${profileId}_${shortid()}`));

function findUserLinkedCollection(
  mods: Record<VortexModId, IMod>,
  profileId: VortexProfileId,
): IMod | undefined {
  return Object.values(mods).find(
    (mod) => isEditableCollectionMod(mod) && mod.attributes?.associatedProfile === profileId,
  );
}

// A profile's collection: the one the user linked to it, else its conventional one unless linked elsewhere.
export function findLinkedCollection(
  mods: Record<VortexModId, IMod>,
  profileId: VortexProfileId,
): IMod | undefined {
  const linked = findUserLinkedCollection(mods, profileId);
  if (linked !== undefined) {
    return linked;
  }
  const own = mods[toVortexModId(makeCollectionId(profileId))];
  const linkedElsewhere = own?.attributes?.associatedProfile !== undefined;
  return own?.type === MOD_TYPE && !linkedElsewhere ? own : undefined;
}

// The collection Update Collection writes to, or a free id for Init Collection to create it under.
export function profileCollectionTarget(
  mods: Record<VortexModId, IMod>,
  profileId: VortexProfileId,
): { mod: IMod | undefined; id: VortexModId } {
  const mod = findLinkedCollection(mods, profileId);
  if (mod !== undefined) {
    return { mod, id: toVortexModId(mod.id) };
  }
  const conventionalId = toVortexModId(makeCollectionId(profileId));
  return {
    mod: undefined,
    id: mods[conventionalId] === undefined ? conventionalId : freshCollectionId(profileId),
  };
}

// The associatedProfile writes that link a profile to a collection, or unlink it when none is given.
export function profileLinkChanges(
  mods: Record<VortexModId, IMod>,
  profileId: VortexProfileId,
  collectionId: VortexModId | undefined,
): IProfileLinkChange[] {
  const current = findUserLinkedCollection(mods, profileId);
  const changes: IProfileLinkChange[] = [];
  if (current !== undefined && current.id !== collectionId) {
    changes.push({ collectionId: toVortexModId(current.id), associatedProfile: undefined });
  }
  if (collectionId !== undefined) {
    changes.push({ collectionId, associatedProfile: profileId });
  }
  return changes;
}

// Link Collection is offered on a profile of the active game while there is an editable collection to pick.
export function canLinkProfile(state: IState, profileId: VortexProfileId): boolean {
  const gameMode = selectors.activeGameId(state);
  return (
    selectors.profileById(state, profileId)?.gameId === gameMode &&
    Object.values(selectors.modsForGame(state, gameMode)).some(isEditableCollectionMod)
  );
}

export async function linkProfileToCollection(
  api: IExtensionApi,
  profileId: VortexProfileId,
): Promise<void> {
  const state = api.getState();
  const gameMode = selectors.activeGameId(state);
  const mods = selectors.modsForGame(state, gameMode);
  const current = findLinkedCollection(mods, profileId);
  // a profile's conventional collection is its own; only a link the user made can be removed
  const canUnlink = findUserLinkedCollection(mods, profileId) !== undefined;

  const result = await api.showDialog(
    "question",
    "Link Collection to Profile",
    {
      text:
        "Select the collection to associate with this profile. " +
        '"Update Collection" will sync this profile\'s mods into the selected collection.',
      choices: Object.values(mods)
        .filter(isEditableCollectionMod)
        .map((mod) => ({ id: mod.id, text: renderModName(mod), value: mod.id === current?.id })),
    },
    [
      { label: "Cancel" },
      ...(canUnlink ? [{ label: "Unlink" }] : []),
      { label: "Link", default: true },
    ],
  );

  // the choices come back keyed by collection id, true for the picked one
  const input: unknown = result.input;
  const chosen =
    typeof input === "object" && input !== null
      ? Object.entries(input).find(([, picked]) => picked === true)?.[0]
      : undefined;
  const changes =
    result.action === "Unlink"
      ? profileLinkChanges(mods, profileId, undefined)
      : result.action === "Link" && chosen !== undefined
        ? profileLinkChanges(mods, profileId, toVortexModId(chosen))
        : [];
  batchDispatch(
    api.store,
    changes.map(({ collectionId, associatedProfile }) =>
      actions.setModAttribute(gameMode, collectionId, "associatedProfile", associatedProfile),
    ),
  );
}
