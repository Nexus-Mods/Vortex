import group from '../src/extensions/mod_management/util/modGrouping';

describe('modGrouping', () => {
  it('can group by mod id', () => {
    const input = [
      { id: 'a', attributes: { modId: 42 } },
      { id: 'b', attributes: { modId: 43 } },
      { id: 'c', attributes: { modId: 42 } },
    ];
    const result = group(input, { groupBy: 'modId', multipleEnabled: true });
    expect(result).toEqual([
      [{ id: 'a', attributes: { modId: 42 } },
       { id: 'c', attributes: { modId: 42 } }],
      [{ id: 'b', attributes: { modId: 43 } }],
    ]);
  });
  it('can avoid multiple enabled', () => {
    const input = [
      { id: 'a', enabled: true, attributes: { modId: 42, version: '1.1.0' } },
      { id: 'b', enabled: true, attributes: { modId: 43, version: '1.0.0' } },
      { id: 'c', enabled: false, attributes: { modId: 42, version: '1.0.0' } },
      { id: 'd', enabled: true, attributes: { modId: 42, version: '1.0.0' } },
    ];
    const result = group(input, { groupBy: 'modId', multipleEnabled: false });
    expect(result).toEqual([
      [{ id: 'a', enabled: true, attributes: { modId: 42, version: '1.1.0' } },
       { id: 'c', enabled: false, attributes: { modId: 42, version: '1.0.0' } }],
      [{ id: 'd', enabled: true, attributes: { modId: 42, version: '1.0.0' } }],
      [{ id: 'b', enabled: true, attributes: { modId: 43, version: '1.0.0' } }],
    ]);
  });
  it('can group by logical file name', () => {
    const input = [
      { id: 'a', attributes: { modId: 42, logicalFileName: '42' } },
      { id: 'b', attributes: { modId: 43, logicalFileName: '43' } },
      { id: 'c', attributes: { modId: 42, logicalFileName: '42' } },
      { id: 'd', attributes: { modId: 42, logicalFileName: '42_2' } },
    ];
    const result = group(input, { groupBy: 'file', multipleEnabled: true });
    expect(result).toEqual([
      [{ id: 'a', attributes: { modId: 42, logicalFileName: '42' } },
       { id: 'c', attributes: { modId: 42, logicalFileName: '42' } }],
      [{ id: 'd', attributes: { modId: 42, logicalFileName: '42_2' } }],
      [{ id: 'b', attributes: { modId: 43, logicalFileName: '43' } }],
    ]);
  });
  it('can group by file id', () => {
    const input = [
      { id: 'a', attributes: { modId: 42 } },
      { id: 'b', attributes: { modId: 43 } },
      { id: 'c', attributes: { modId: 42 } },
      { id: 'd', attributes: { modId: 42 } },
    ];
    const result = group(input, { groupBy: 'file', multipleEnabled: true });
    expect(result).toEqual([
      [{ id: 'a', attributes: { modId: 42 } }],
      [{ id: 'c', attributes: { modId: 42 } }],
      [{ id: 'd', attributes: { modId: 42 } }],
      [{ id: 'b', attributes: { modId: 43 } }],
    ]);
  });
});
