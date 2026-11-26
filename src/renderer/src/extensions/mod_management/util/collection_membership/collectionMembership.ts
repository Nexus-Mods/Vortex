import type { IExtensionApi } from "../../../../types/IExtensionContext";
import { batchDispatch } from "../../../../util/util";
import { MOD_TYPE as COLLECTION_TYPE } from "../../../collections/constants";
import { addModRule } from "../../actions/mods";
import type { IMod, IModRule } from "../../types/IMod";
import { isFuzzyVersion } from "../isFuzzyVersion";
import modName from "../modName";
import testModReference, {
  findRuleByRef,
  idOnlyRef,
  isDependencyRule,
  isRequiredRule,
  modAttributesToLookupInfo,
  modMatchesInstallSpec,
  ruleInstallSpec,
} from "../testModReference";

/**
 * Maps each of `modIds` that belongs to at least one installed collection to the names of those
 * collections. Mods outside every collection, and collection mods themselves, are left out.
 *
 * Membership is a collection rule matching the mod, the same test the collection code uses to
 * attribute an installed mod to its collection.
 */
export function collectionNamesByMod(
  mods: { [modId: string]: IMod },
  modIds: string[],
): { [modId: string]: string[] } {
  const collections = Object.values(mods).filter((mod) => mod.type === "collection");
  if (collections.length === 0) {
    return {};
  }

  const memberRules = collections.map((collection) => ({
    name: modName(collection),
    rules: (collection.rules ?? []).filter(isDependencyRule),
  }));

  return modIds.reduce<{ [modId: string]: string[] }>((result, modId) => {
    const mod = mods[modId];
    if (mod === undefined || mod.type === "collection") {
      return result;
    }

    const names = memberRules
      .filter(({ rules }) => findRuleByRef(rules, mod) !== undefined)
      .map(({ name }) => name);

    if (names.length > 0) {
      result[modId] = Array.from(new Set(names));
    }
    return result;
  }, {});
}

/**
 * Whether an installed collection other than `installingCollectionId` relies on one of `modIds`
 * the way it is installed now: one of that collection's member rules matches the mod and asks for
 * the install spec (installer choices / file list / patches) the mod was installed with.
 *
 * Replacing such a mod to give it a different install spec would silently change the other
 * collection's install, so the caller has to install a variant next to it.
 */
export function isUsedByOtherCollection(
  mods: { [modId: string]: IMod },
  modIds: string[],
  installingCollectionId: string | undefined,
): boolean {
  const memberRules = Object.values(mods)
    .filter((mod) => mod.type === COLLECTION_TYPE && mod.id !== installingCollectionId)
    .flatMap((collection) =>
      (collection.rules ?? []).filter((rule) => rule.ignored !== true && isDependencyRule(rule)),
    );
  if (memberRules.length === 0) {
    return false;
  }

  return modIds.some((modId) => {
    const mod = mods[modId];
    if (mod === undefined || mod.type === COLLECTION_TYPE) {
      return false;
    }
    const lookup = modAttributesToLookupInfo(mod);
    return memberRules.some(
      (rule) =>
        testModReference(lookup, rule.reference) &&
        modMatchesInstallSpec(lookup, ruleInstallSpec(rule)),
    );
  });
}

/** Whether the rule requires one version of its mod, which an update no longer satisfies. */
const pinsVersion = (rule: IModRule): boolean =>
  isRequiredRule(rule) &&
  !idOnlyRef(rule.reference) &&
  !isFuzzyVersion(rule.reference.versionMatch);

/**
 * Sets the collection rules that pin the given mods to a version to ignored, the change the
 * install's "Ignore" makes for an update those rules no longer match.
 */
export function ignorePinnedCollectionRules(
  api: IExtensionApi,
  gameId: string,
  modIds: string[],
): void {
  const mods = api.getState().persistent.mods[gameId] ?? {};
  const pinningRulesByCollection = Object.values(mods)
    .filter((mod) => mod.type === COLLECTION_TYPE)
    .map((collection) => ({
      collectionId: collection.id,
      rules: (collection.rules ?? []).filter((rule) => rule.ignored !== true && pinsVersion(rule)),
    }));

  batchDispatch(
    api.store,
    modIds.flatMap((modId) => {
      const mod = mods[modId];
      if (mod === undefined) {
        return [];
      }
      const lookup = modAttributesToLookupInfo(mod);
      return pinningRulesByCollection.flatMap(({ collectionId, rules }) => {
        const rule = rules.find((iter) => testModReference(lookup, iter.reference));
        return rule === undefined
          ? []
          : [addModRule(gameId, collectionId, { ...rule, ignored: true })];
      });
    }),
  );
}
