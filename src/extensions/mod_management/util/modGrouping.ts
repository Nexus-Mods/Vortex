import { getSafe, pushSafe } from '../../../util/storeHelper';
import { IModWithState } from '../types/IModProps';

import { compare } from 'semvish';

function byModId(input: IModWithState[]): IModWithState[][] {
  const byModId = input.reduce((prev: { [modId: string]: IModWithState[] }, value) =>
    pushSafe(prev, [getSafe(value, ['attributes', 'modId'], undefined)], value)
    , {});
  return Object.keys(byModId).map(modId => byModId[modId]);
}

function fileId(value: IModWithState): string {
  let result = getSafe(value.attributes, ['logicalFileName'], undefined);
  if (result !== undefined) {
    return 'l' + result;
  }
  result = getSafe(value.attributes, ['fileExpression'], undefined);
  if (result !== undefined) {
    return 'e' + result;
  }
  result = getSafe(value.attributes, ['newestFileId'], 'unknown');
  if (result !== 'unknown') {
    return 'n' + result;
  }
  return 'i' + value.id;
}

function byFile(input: IModWithState[]): IModWithState[][] {
  const result = input.reduce((prev: { [fileId: string]: IModWithState[] }, value) => {
    return pushSafe(prev, [fileId(value)], value);
  }, {});
  return Object.keys(result).map(fileId => result[fileId]);
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
    (lhs, rhs) => compare(rhs[0].attributes['version'],
                          lhs[0].attributes['version']))[0];
  input.filter((mod => !mod.enabled)).forEach(mod => primaryGroup.push(mod));
  return groups;
}

function group(input: IModWithState[][],
               groupFunc: (input: IModWithState[]) => IModWithState[][]): IModWithState[][] {
  return input.reduce((prev: IModWithState[][], value) => {
    return [].concat(prev, groupFunc(value));
  }, []);
}

export interface IGroupingOptions {
  multipleEnabled: boolean;
  groupBy: 'modId' | 'file';
}

function groupMods(mods: IModWithState[], options: IGroupingOptions): IModWithState[][] {
  const modList: IModWithState[][] = [ Object.keys(mods).map(key => mods[key]) ];

  let temp: IModWithState[][];
  if (options.groupBy === 'modId') {
    temp = group(modList, byModId);
  } else {
    temp = group(group(modList, byModId), byFile);
  }

  if (!options.multipleEnabled) {
    temp = group(temp, byEnabled);
  }

  return temp;
  }

export default groupMods;
