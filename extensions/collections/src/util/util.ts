import Bluebird from "bluebird";
import { createHash } from "crypto";
import {
  ICollectionPermission,
  CollectionPermission,
} from "@nexusmods/nexus-api";
import type { types } from "vortex-api";
import type { ICollectionModRuleEx } from "../types/ICollection";
import type { IModEx } from "../types/IModEx";

export function hasEditPermissions(
  permissions: ICollectionPermission[],
): boolean {
  if (!permissions) {
    return false;
  }
  const allPermissions: CollectionPermission[] = permissions.map(
    (perm) => perm.key as CollectionPermission,
  );
  return allPermissions.includes("collection:edit");
}

export function bbProm<T>(
  func: (...args: any[]) => Promise<T>,
): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

export function getUnfulfilledNotificationId(collectionId: string) {
  return `collection-incomplete-${collectionId}`;
}

export function md5sum(input: string): string {
  const hash = createHash("md5");
  hash.update(input);
  return hash.digest("hex");
}

export function ruleId(rule: ICollectionModRuleEx): string {
  // md5-hashing to prevent excessive id names and special characters as a key
  // in application state
  return md5sum(`${rule.sourceName}-${rule.type}-${rule.referenceName}`);
}

export function isRelevant(mod: IModEx) {
  if (!!mod.state) {
    // consider any mod that's already being downloaded/installed
    return true;
  }
  if (mod.collectionRule["ignored"]) {
    return false;
  }
  if (mod.collectionRule.type !== "requires") {
    return false;
  }

  return true;
}

export type IModWithRule = types.IMod & { collectionRule: types.IModRule };

export function calculateCollectionSize(mods: {
  [id: string]: IModWithRule;
}): number {
  return Object.values(mods).reduce((prev: number, mod: IModEx) => {
    if (!isRelevant(mod)) {
      return prev;
    }
    const size =
      mod.attributes?.fileSize ?? mod.collectionRule.reference.fileSize ?? 0;
    return prev + size;
  }, 0);
}

export function isEmpty(value: any) {
  return (
    !value ||
    (value.hasOwnProperty("length") && value.length === 0) ||
    (value.constructor === Object && Object.keys(value).length === 0)
  );
}
