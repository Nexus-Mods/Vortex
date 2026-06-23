import { createHash } from "crypto";

import type { CollectionPermission, ICollectionPermission } from "@nexusmods/nexus-api";
import Bluebird from "bluebird";

import type { ICollectionModRuleEx } from "../types/ICollection";

export function hasEditPermissions(permissions: ICollectionPermission[]): boolean {
  if (!permissions) {
    return false;
  }
  const allPermissions: CollectionPermission[] = permissions.map(
    (perm) => perm.key as CollectionPermission,
  );
  return allPermissions.includes("collection:edit");
}

export function bbProm<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
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

export function isEmpty(value: any) {
  return (
    !value ||
    (value.hasOwnProperty("length") && value.length === 0) ||
    (value.constructor === Object && Object.keys(value).length === 0)
  );
}
