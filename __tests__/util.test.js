import * as util from '../src/util/util';

// for the tests regarding invalid filename detection/sanitation we need a consistent
// platform and windows is just way more "interesting" in this regard
jest.mock('process', () => ({
  platform: 'win32',
}));

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
  it('doesn\'t fail if object has overloaded hasOwnProperty', () => {
    let res = util.objDiff({ hasOwnProperty: 1, foo: 42 }, { hasOwnProperty: 2, foo: 42 });
    expect(res).toEqual({
      '-hasOwnProperty': 1,
      '+hasOwnProperty': 2,
    })
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
    const invalidNames = [
      'foo\\b/ar.txt',
      'con\\bar.txt',
      'foo\\..\\bar.txt',
      '\\foo\\bar',
    ];
    invalidNames.forEach(name => {
      expect(util.isPathValid(name)).toBe(false);
    });
  });
  it('allows valid names', () => {
    const validNames = [
      'foo\\bar.txt',
      'c:\\conx\\bar.txt',
      '\\\\server\\foo\\bar',
      'foo\\bar\\'
    ];
    validNames.forEach(name => {
      expect(util.isPathValid(name)).toBe(true);
    });
  });
  it('can be set to allow relative paths', () => {
    const validNames = [
      'c:\\conx\\..\\bar.txt',
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
    expect(util.unique([{ k: 1, v: 1 }, { k: 1, v: 2 }, { k: 2, v: 1 }], i => i.k))
      .toEqual([{ k: 1, v: 1 }, { k: 2, v: 1 }]);
  });
});

describe('sanitizeFilename', () => {
  it('sanitizes disallowed characters', () => {
    expect(util.sanitizeFilename('foo*bar')).toBe('foo_42_bar');
  });
  it('sanitizes reserved names', () => {
    expect(util.sanitizeFilename('LPT1.txt')).toBe('_reserved_LPT1.txt');
  });
  it('sanitizes invalid trailing character', () => {
    expect(util.sanitizeFilename('foobar.')).toBe('foobar._');
  });
});

describe('nexusModsURL', () => {
  it('creates basic urls', () => {
    expect(util.nexusModsURL(['foo', 'bar'])).toBe('https://www.nexusmods.com/foo/bar');
  });
  it('supports different subdomains', () => {
    expect(util.nexusModsURL(['foo', 'bar'], { section: util.Section.Users }))
      .toBe('https://users.nexusmods.com/foo/bar');
  });
  it('supports tracking campaigns', () => {
    expect(util.nexusModsURL(['foo', 'bar'], { campaign: util.Campaign.ViewCollection }))
      .toBe('https://www.nexusmods.com/foo/bar?utm_medium=vortex&utm_source=vortex&utm_campaign=view_collection');
  });
  it('supports additional parameters', () => {
    expect(util.nexusModsURL(['foo', 'bar'], {
      campaign: util.Campaign.ViewCollection,
      parameters: ['foo=bar'],
    }))
      .toBe('https://www.nexusmods.com/foo/bar?foo=bar&utm_medium=vortex&utm_source=vortex&utm_campaign=view_collection');
  });
});
