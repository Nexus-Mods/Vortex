import { describe, it, expect } from '@jest/globals';
import { InstructionGroups } from '../../../src/extensions/mod_management/install/InstructionGroups';

describe('InstructionGroups', () => {
  it('should initialize with empty arrays for all instruction types', () => {
    const groups = new InstructionGroups();

    expect(groups.copy).toEqual([]);
    expect(groups.mkdir).toEqual([]);
    expect(groups.submodule).toEqual([]);
    expect(groups.generatefile).toEqual([]);
    expect(groups.iniedit).toEqual([]);
    expect(groups.unsupported).toEqual([]);
    expect(groups.attribute).toEqual([]);
    expect(groups.setmodtype).toEqual([]);
    expect(groups.error).toEqual([]);
    expect(groups.rule).toEqual([]);
    expect(groups.enableallplugins).toEqual([]);
  });

  it('should allow adding instructions to each group', () => {
    const groups = new InstructionGroups();

    const copyInstruction = { type: 'copy' as const, source: 'src', destination: 'dest' };
    const mkdirInstruction = { type: 'mkdir' as const, destination: 'newdir' };
    const attributeInstruction = { type: 'attribute' as const, key: 'version', value: '1.0' };

    groups.copy.push(copyInstruction);
    groups.mkdir.push(mkdirInstruction);
    groups.attribute.push(attributeInstruction);

    expect(groups.copy).toHaveLength(1);
    expect(groups.copy[0]).toEqual(copyInstruction);
    expect(groups.mkdir).toHaveLength(1);
    expect(groups.mkdir[0]).toEqual(mkdirInstruction);
    expect(groups.attribute).toHaveLength(1);
    expect(groups.attribute[0]).toEqual(attributeInstruction);
  });

  it('should allow multiple instructions per group', () => {
    const groups = new InstructionGroups();

    groups.copy.push({ type: 'copy' as const, source: 'a', destination: 'b' });
    groups.copy.push({ type: 'copy' as const, source: 'c', destination: 'd' });
    groups.copy.push({ type: 'copy' as const, source: 'e', destination: 'f' });

    expect(groups.copy).toHaveLength(3);
  });

  it('should keep groups independent of each other', () => {
    const groups = new InstructionGroups();

    groups.copy.push({ type: 'copy' as const, source: 'a', destination: 'b' });
    groups.error.push({ type: 'error' as const, value: 'Some error' });

    expect(groups.copy).toHaveLength(1);
    expect(groups.error).toHaveLength(1);
    expect(groups.mkdir).toHaveLength(0);
  });
});
