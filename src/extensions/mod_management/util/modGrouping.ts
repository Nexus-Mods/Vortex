import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IModWithState } from '../types/IModProps';

import { coerce, compare, valid } from 'semver';

function byModId(input: IModWithState[]): IModWithState[][] {
  const grouped = input.reduce((prev: { [modId: string]: IModWithState[] }, value) => {
    const modId = value?.attributes?.modId ?? value?.attributes?.collectionSlug;
    if (prev[modId] === undefined) {
      prev[modId] = [];
    }
    prev[modId].push(value);
    return prev;
  }, {});
  return Object.keys(grouped).map(modId => grouped[modId]);
}

function logicalName(attributes: any) {
  if ((attributes.logicalFileName === undefined)
      || (attributes.version === undefined)) {
    return attributes.logicalFileName;
  }
  return attributes.logicalFileName.replace(attributes.version, '').trim();
}

function fileMatch(lhs: IModWithState, rhs: IModWithState): boolean {
  if ((lhs.attributes === undefined) || (rhs.attributes === undefined)) {
    return false;
  }

  if ((lhs.attributes?.collectionSlug !== undefined)
      || (rhs.attributes?.collectionSlug !== undefined)) {
    // atm never group collections, we don't support having multiple revisions of a collection
    // installed at the same time anyway
    return false;
  }

  if (truthy(lhs.attributes.newestFileId)
      && truthy(lhs.attributes.modId !== undefined)
      && (lhs.attributes.newestFileId === rhs.attributes.newestFileId)) {
    return true;
  }

  if (truthy(lhs.attributes.logicalFileName)
      && (logicalName(lhs.attributes) === logicalName(rhs.attributes))) {
    return true;
  }

  return false;
}

function byFile(input: IModWithState[]): IModWithState[][] {
  if (input.length === 1) {
    return [input];
  }
  const groups: IModWithState[][] = [];
  input.forEach((mod: IModWithState) => {
    // TODO: O(n^2)
    const fileGroup = groups.find(iter => fileMatch(iter[0], mod));
    if (fileGroup === undefined) {
      groups.push([mod]);
    } else {
      fileGroup.push(mod);
    }
  });
  return groups;
}

function newestFirst(lhs: IModWithState, rhs: IModWithState): number {
  if (lhs.enabled !== rhs.enabled) {
    return rhs.enabled ? 1 : -1;
  }
  const lVersion = getSafe(lhs, ['attributes', 'version'], '0.0.0') || '0.0.0';
  const rVersion = getSafe(rhs, ['attributes', 'version'], '0.0.0') || '0.0.0';
  if (valid(coerce(lVersion)) && valid(coerce(rVersion))) {
    return compare(coerce(rVersion), coerce(lVersion));
  } else {
    return rVersion.localeCompare(lVersion);
  }
}

/**
 * contrary to what the name implies, this doesn't group enabled mods with other enabled ones but
 * it ensures that only one enabled mod is in the output.
 *
 * @param {IModWithState[]} input
 * @returns {IModWithState[][]}
 */
function byEnabled(input: IModWithState[]): IModWithState[][] {
  // put each enabled mod into its own group. Ideally there should only be one
  const groups: IModWithState[][] = input.filter((mod => mod?.enabled === true)).map(mod => [mod]);
  // it is of course possible that no mod in input is enabled.
  if (groups.length === 0) {
    return [ input ];
  }
  // disabled mods are only added to the group with the highest version enabled mod
  const primaryGroup = groups.sort((lhs, rhs) => newestFirst(lhs[0], rhs[0]))[0];
  input.filter((mod => !mod.enabled)).forEach(mod => primaryGroup.push(mod));
  return groups;
}

function byEnabledTime(lhs: IModWithState, rhs: IModWithState): number {
  const lTime = lhs.enabledTime || 0;
  const rTime = rhs.enabledTime || 0;

  if ((lTime !== 0) || (rTime !== 0)) {
    return rTime - lTime;
  }
  return newestFirst(lhs, rhs);
}

function group(input: IModWithState[][],
               groupFunc: (input: IModWithState[]) => IModWithState[][]): IModWithState[][] {
  return input.reduce((prev: IModWithState[][], value: IModWithState[]) =>
    [].concat(prev, groupFunc(value)), []);
}

export interface IGroupingOptions {
  multipleEnabled: boolean;
  groupBy: 'modId' | 'file';
}

function groupMods(mods: IModWithState[], options: IGroupingOptions): IModWithState[][] {
  const modList: IModWithState[][] = [ mods ];

  let temp: IModWithState[][] = (options.groupBy === 'modId')
    ? group(modList, byModId)
    : group(group(modList, byModId), byFile);

  if (!options.multipleEnabled) {
    temp = group(temp, byEnabled);
  }

  return temp.map(iter => iter.sort(byEnabledTime));
}

export default groupMods;
