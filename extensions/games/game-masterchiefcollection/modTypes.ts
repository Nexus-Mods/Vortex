import path from 'path';
import { types } from 'vortex-api';
import { MOD_INFO_JSON_FILE } from './common';

export async function testPlugAndPlayModType(instr: types.IInstruction[]) {
  const modInfo = instr.find(instr => instr.type === 'copy' && path.basename(instr.source).toLowerCase() === MOD_INFO_JSON_FILE);
  return modInfo !== undefined;
}