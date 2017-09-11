import { getSafe, pushSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IModWithState } from '../types/IModProps';

import { compare } from 'semvish';

function byModId(input: IModWithState[]): IModWithState[][] {
  const grouped = input.reduce((prev: { [modId: string]: IModWithState[] }, value) => {
    const modId = getSafe(value, ['attributes', 'modId'], undefined);
    if (prev[modId] === undefined) {
      prev[modId] = [];
    }
    prev[modId].push(value);
    return prev;
  }, {});
  return Object.keys(grouped).map(modId => grouped[modId]);
}

interface IFileId {
  newestFileId?: string;
  logicalFileName?: string;
  fileId: string;
}

function fileId(value: IModWithState): string {
  let result = getSafe(value.attributes, ['newestFileId'], undefined);
  if (result !== undefined) {
    return 'n' + result;
  }
  result = getSafe(value.attributes, ['logicalFileName'], undefined);
  if (result !== undefined) {
    return 'l' + result;
  }
  return 'i' + value.id;
}

function fileMatch(lhs: IModWithState, rhs: IModWithState): boolean {
  if (truthy(lhs.attributes.newestFileId) && truthy(rhs.attributes.newestFileId)) {
    return lhs.attributes.newestFileId === rhs.attributes.newestFileId;
  } else if (truthy(lhs.attributes.logicalFileName) && truthy(rhs.attributes.logicalFileName)) {
    return lhs.attributes.logicalFileName === rhs.attributes.logicalFileName;
  }
  return false;
}

function byFile(input: IModWithState[]): IModWithState[][] {
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

/**
 * contrary to what the name implies, this doesn't group enabled mods with other enabled ones but
 * it ensures that only one enabled mod is in the output.
 *
 * @param {IModWithState[]} input
 * @returns {IModWithState[][]}
 */
function byEnabled(input: IModWithState[]): IModWithState[][] {
  // put each enabled mod into its own group. Ideally there should only be one
  const groups: IModWithState[][] = input.filter((mod => mod.enabled)).map(mod => [mod]);
  // it is of course possible that no mod in input is enabled.
  if (groups.length === 0) {
    return [ input ];
  }
  // disabled mods are only added to the group with the highest version enabled mod
  const primaryGroup = groups.sort(
    (lhs, rhs) => compare(rhs[0].attributes['version'] || '0.0.0',
                          lhs[0].attributes['version'] || '0.0.0'))[0];
  input.filter((mod => !mod.enabled)).forEach(mod => primaryGroup.push(mod));
  return groups;
}

function group(input: IModWithState[][],
               groupFunc: (input: IModWithState[]) => IModWithState[][]): IModWithState[][] {
  return input.reduce((prev: IModWithState[][], value: IModWithState[]) => {
    return [].concat(prev, groupFunc(value));
  }, []);
}

export interface IGroupingOptions {
  multipleEnabled: boolean;
  groupBy: 'modId' | 'file';
}

function groupMods(mods: IModWithState[], options: IGroupingOptions): IModWithState[][] {
  const modList: IModWithState[][] = [ Object.keys(mods).map(key => mods[key]) ];

  let temp: IModWithState[][] = (options.groupBy === 'modId')
    ? group(modList, byModId)
    : group(group(modList, byModId), byFile);

  if (!options.multipleEnabled) {
    temp = group(temp, byEnabled);
  }

  return temp;
}

export default groupMods;
