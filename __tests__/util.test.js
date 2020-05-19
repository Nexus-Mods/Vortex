import * as util from '../src/util/util';

describe('objDiff', () => {
  it('finds added entries', () => {
    const res = util.objDiff({ old: 'a' }, { old: 'a', new: 'b' });
    expect(res).toEqual({
      '+new': 'b',
    });
  });
  it('finds removed entries', () => {
    const res = util.objDiff({ old: 'a', rem: 'b' }, { old: 'a' });
    expect(res).toEqual({
      '-rem': 'b',
    });
  });
  it('finds changed entries', () => {
    const res = util.objDiff({ chng: 'a' }, { chng: 'b' });
    expect(res).toEqual({
      '-chng': 'a',
      '+chng': 'b',
    });
  });
  it('supports nested', () => {
    const res = util.objDiff({ outer: { chng: 'a' } }, { outer: { chng: 'b' }});
    expect(res).toEqual({
      outer: {
        '-chng': 'a',
        '+chng': 'b',
      }
    });
  });
  it('supports difference in type', () => {
    let res = util.objDiff({ chng: 42 }, { chng: { a: 13 } });
    expect(res).toEqual({
      '-chng': 42,
      '+chng': { a: 13 },
    });

    res = util.objDiff({ chng: { a: 13 } }, { chng: 42 });
    expect(res).toEqual({
      '-chng': { a: 13 },
      '+chng': 42,
    });
  });
});

describe('isFilenameValid', () => {
  it('reports invalid filenames', () => {
    const invalidNames = (process.platform === 'win32')
      ? [
        'FOO/BAR.txt',
        'foo?bar.txt',
        'foo*bar.txt',
        'foo:bar.txt',
        'foo|bar.txt',
        'foo"bar.txt',
        'foo<bar.txt',
        'foo>bar.txt',
        'CON',
        'COM3',
        'LPT4',
        'NUL.txt',
        'aux.exe',
        '..',
        '.'
      ]
      : [
        '..',
        '.'
      ];

    invalidNames.forEach(name => {
      expect(util.isFilenameValid(name)).toBe(false);
    });
  });

  it('allows valid names', () => {
    const validNames = (process.platform === 'win32')
      ? [
        'foobar.txt',
        'foo.bar.txt',
        'foo%bar.txt',
        'fööbär.txt',
        'null.txt',
        '..foobar.txt',
      ]
      : [];

    validNames.forEach(name => {
      expect(util.isFilenameValid(name)).toBe(true);
    });
  });
});

describe('isPathValid', () => {
  it('reports invalid path', () => {
    const invalidNames = (process.platform === 'win32')
      ? [
        'foo\\b/ar.txt',
        'con\\bar.txt',
        'foo\\..\\bar.txt',
        '\\foo\\bar',
      ]
      : [
        'foo/../bar.txt',
        'foo\\bar.txt',
        'c:\\foo\\bar.txt',
        'c:/foo/bar.txt',
      ];
    invalidNames.forEach(name => {
      expect(util.isPathValid(name)).toBe(false);
    });
  });
  it('allows valid names', () => {
    const validNames = (process.platform === 'win32')
      ? [
        'foo\\bar.txt',
        'c:\\conx\\bar.txt',
        '\\\\server\\foo\\bar',
        'foo\\bar\\'
      ]
      : [
        'foo/bar.txt'
      ];
    validNames.forEach(name => {
      expect(util.isPathValid(name)).toBe(true);
    });
  });
  it('can be set to allow relative paths', () => {
    const validNames = (process.platform === 'win32')
      ? [
        'c:\\conx\\..\\bar.txt',
      ]
      : [
        'foo/../bar.txt'
      ];
    validNames.forEach(name => {
      expect(util.isPathValid(name, true)).toBe(true);
    });
  });
});

describe('isMajorUpgrade', () => {
  it('detects major downgrade', () => {
    expect(util.isMajorDowngrade('2.0.0', '1.0.0')).toBe(true);
    expect(util.isMajorDowngrade('1.0.0', '0.9.0')).toBe(true);
  });
  it('detects minor downgrade', () => {
    expect(util.isMajorDowngrade('1.2.0', '1.1.0')).toBe(true);
    expect(util.isMajorDowngrade('0.2.0', '0.1.0')).toBe(true);
  });
  it('doesn\'t report patch downgrade', () => {
    expect(util.isMajorDowngrade('1.0.2', '1.0.1')).toBe(false);
    expect(util.isMajorDowngrade('0.2.2', '0.2.1')).toBe(false);
  });
  it('doesn\'t report upgrade', () => {
    expect(util.isMajorDowngrade('1.1.0', '1.2.0')).toBe(false);
    expect(util.isMajorDowngrade('0.1.0', '0.2.0')).toBe(false);
    expect(util.isMajorDowngrade('1.0.0', '2.0.0')).toBe(false);
    expect(util.isMajorDowngrade('0.9.0', '1.0.0')).toBe(false);
  });
});

describe('unique', () => {
  it('removes duplicates, keeping the first item', () => {
    expect(util.unique([{ k: 1, v: 1 }, { k: 1, v: 2}, {k: 2, v: 1}], i => i.k))
      .toEqual([{ k: 1, v: 1 }, { k: 2, v: 1 }]);
  });
});
