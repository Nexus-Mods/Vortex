import { CONFIG_MATRIX_REL_PATH, PART_SUFFIX } from './common';
import path from 'path';
import { types } from 'vortex-api';

const destHasRootDir = (instruction: types.IInstruction, dir: string) => {
  if (!instruction?.destination) {
    return false;
  }
  const segments = instruction.destination.split(path.sep);
  return segments[0].toLowerCase() === dir.toLowerCase();
}

export function testTL(instructions: types.IInstruction[]) {
  const hasConfigMatrix = instructions.some(instr => !!instr.source
    && instr.source.indexOf(CONFIG_MATRIX_REL_PATH) !== -1);
  const hasSettingsConfig = instructions.some(instr =>
    instr?.source?.toLowerCase?.()?.endsWith?.(PART_SUFFIX));
  if (hasConfigMatrix || hasSettingsConfig) {
    return Promise.resolve(false);
  }

  const hasModsDir = instructions.some(instr => destHasRootDir(instr, 'mods'));
  const hasBinDir = instructions.some(instr => destHasRootDir(instr, 'bin'));
  return Promise.resolve(hasModsDir || hasBinDir);
}

export function testDLC(instructions: types.IInstruction[]) {
  return Promise.resolve(instructions.find(
    instruction => !!instruction.destination && instruction.destination.toLowerCase().startsWith('dlc' + path.sep)) !== undefined);
}